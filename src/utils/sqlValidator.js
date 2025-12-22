/**
 * SQL 前端预校验逻辑：
 * 1. 基础处理：去除 BOM 字符 (\uFEFF) 和首尾空格,确保解析准确。
 * 2. 分词解析：利用正则提取有效 Token,跳过注释、字符串和方括号内容,防止通过注释或字符串内容绕过校验。
 * 3. 安全拦截：
 *     检测分号,禁止多语句批量执行。
 *     校验首个关键字与操作按钮类型的一致性。
 *     拦截危险关键字 (DROP, TRUNCATE 等) 及混合操作 (如 SELECT 中夹带 DELETE)。
 * 4. 业务规则：
 *     SELECT: 递归检查所有 SELECT 关键字后是否紧跟 TOP N,并限制最大行数为 1000。
 *     UPDATE/DELETE: 强制检查 WHERE 子句存在性,拦截恒真条件 (1=1, 'a'='a'),确保包含精确匹配条件 (=/IN)。
 */
export function validateSqlServerSql(sql, operationType) {
  const trimmedSql = sql.replace(/\uFEFF/g, '').trim();
  if (!trimmedSql) {
    return { valid: false, message: 'SQL语句不能为空' };
  }
  // 安全校验：通过分词检查关键字数量,防止多语句执行(如 UPDATE...DELETE)及危险操作
  // 正则匹配: 1.单行注释 2.多行注释 3.字符串(含N'xx') 4.方括号标识符 5.分号 6.左括号 7.右括号 8.关键字
  const tokenRegex = /(--[^\r\n]*)|(\/\*[\s\S]*?\*\/)|(N?'(?:''|[^'])*')|(\[[^\]]*\])|(;)|(\()|(\))|\b(SELECT|UPDATE|INSERT|DELETE|DROP|TRUNCATE|ALTER|CREATE|RENAME|UNION|INTERSECT|EXCEPT)\b/gi;
  const tokens = [...trimmedSql.matchAll(tokenRegex)];
  const kwCounts = { SELECT: 0, UPDATE: 0, INSERT: 0, DELETE: 0, DANGEROUS: 0 };
  let firstKeyword = null;
  let hasSemicolon = false;

  // 括号层级和Level0的SELECT计数,用于检测未分隔的多条SELECT语句
  let parenLevel = 0;
  let selectCountLevel0 = 0;
  let lastLevel0Keyword = null;

  for (const match of tokens) {
    if (match[1] || match[2] || match[3] || match[4]) continue; // 跳过注释、字符串和方括号标识符
    if (match[5]) { // Group 5 是分号
      hasSemicolon = true;
      continue;
    }
    if (match[6]) { // (括号
      parenLevel++;
      continue;
    }
    if (match[7]) { // )括号
      parenLevel--;
      continue;
    }

    const kw = match[8].toUpperCase(); // Group 8 是关键字
    if (!firstKeyword) firstKeyword = kw; // 记录找到的第一个有效关键字
    // 如果之前已经出现了分号,且现在又出现了新的关键字,说明是多条语句
    if (hasSemicolon) {
      return { valid: false, message: '检测到多条SQL语句（通过分号分隔）,请一次只执行一条语句' };
    }
    if (['DROP', 'TRUNCATE', 'ALTER', 'CREATE', 'RENAME'].includes(kw)) {
      kwCounts.DANGEROUS++;
    } else if (['UNION', 'INTERSECT', 'EXCEPT'].includes(kw)) {
      if (parenLevel === 0) lastLevel0Keyword = kw;
    } else {
      kwCounts[kw] = (kwCounts[kw] || 0) + 1;
    }

    // 针对 SELECT 的特殊校验：检测 Level 0 下是否有多个 SELECT 且未通过集合运算符连接
    if (kw === 'SELECT') {
      if (parenLevel === 0) {
        if (selectCountLevel0 > 0) {
          if (!['UNION', 'INTERSECT', 'EXCEPT'].includes(lastLevel0Keyword)) {
            return { valid: false, message: '检测到多条 SELECT 语句（未通过 UNION/INTERSECT/EXCEPT 连接）,请一次只执行一条语句' };
          }
        }
        selectCountLevel0++;
        lastLevel0Keyword = 'SELECT';
      }
    } else if (parenLevel === 0 && !['UNION', 'INTERSECT', 'EXCEPT'].includes(kw)) {
      lastLevel0Keyword = kw;
    }
  }
  // 1. 通用校验：检查第一个有效关键字是否匹配操作类型 (忽略开头的注释)
  if (!firstKeyword || firstKeyword !== operationType) {
    return { valid: false, message: `${operationType} 语句必须以 ${operationType} 开头` };
  }
  // 检查危险关键字 (保留原逻辑：INSERT操作允许包含CREATE等,其他不允许)
  if (operationType !== 'INSERT' && kwCounts.DANGEROUS > 0) {
    return { valid: false, message: '语句中包含危险关键字 (DROP, TRUNCATE, ALTER, CREATE, RENAME)' };
  }
  // 检查混合操作/多语句 (即使没有分号也能检测)
  if (operationType === 'SELECT') {
    if (kwCounts.UPDATE > 0 || kwCounts.INSERT > 0 || kwCounts.DELETE > 0) {
      return { valid: false, message: '查询语句不允许包含 UPDATE/INSERT/DELETE 操作' };
    }
  }

  // 4. 特定操作类型的校验
  switch (operationType) {
    case 'UPDATE':
    case 'INSERT':
    case 'DELETE':
      // 确保主操作关键字数量为 1 (防止 UPDATE...UPDATE)
      if (kwCounts[operationType] > 1) {
        return { valid: false, message: `检测到多个 ${operationType} 关键字,禁止执行多条语句` };
      }
      // 检查是否包含其他 DML 关键字 (例如 UPDATE 中包含 DELETE)
      const otherDmls = ['UPDATE', 'INSERT', 'DELETE'].filter(k => k !== operationType);
      for (const other of otherDmls) {
        if (kwCounts[other] > 0) {
          return { valid: false, message: `${operationType} 语句不允许包含 ${other} 操作` };
        }
      }
      // INSERT 不需要检查 WHERE
      if (operationType === 'INSERT') break;
      // 使用正则查找真正的 WHERE 关键字 (忽略注释、字符串、方括号)
      const whereRegex = /(--[^\r\n]*)|(\/\*[\s\S]*?\*\/)|(N?'(?:''|[^'])*')|(\[[^\]]*\])|(\bWHERE\b)/gi;
      const whereMatches = [...trimmedSql.matchAll(whereRegex)];
      let rawWhereClause = null;
      for (const match of whereMatches) {
        if (match[1] || match[2] || match[3] || match[4]) continue;
        if (match[5]) {
          rawWhereClause = trimmedSql.substring(match.index + match[0].length);
          break;
        }
      }
      if (rawWhereClause === null) {
        return { valid: false, message: `${operationType} 操作必须包含WHERE条件以防止全表操作` };
      }
      // 清理 WHERE 子句：只去除注释,保留字符串内容
      let cleanWhereClause = rawWhereClause.replace(/(--[^\r\n]*)|(\/\*[\s\S]*?\*\/)/g, ' ');
      // 移除后续子句和末尾分号
      cleanWhereClause = removeSubsequentClauses(cleanWhereClause);
      if (cleanWhereClause.trim().endsWith(';')) {
        cleanWhereClause = cleanWhereClause.trim().slice(0, -1);
      }
      cleanWhereClause = cleanWhereClause.trim();
      // 检查WHERE条件是否为恒真条件
      if (isAlwaysTrueCondition(cleanWhereClause)) {
        return { valid: false, message: 'WHERE条件疑似为恒真条件(如 1=1),操作被禁止' };
      }
      // 检查WHERE条件是否包含等号(=)或IN子句指定精确条件效防止因缺少精确条件（如主键/唯一键）而导致的大范围更新或删除
      const hasSpecificCondition = cleanWhereClause.includes('=') || cleanWhereClause.toUpperCase().includes(' IN ');
      if (!hasSpecificCondition) {
        return { valid: false, message: '高危操作的WHERE条件必须包含等号(=)或IN子句进行精确匹配,以防止大范围误操作。' };
      }
      break;
    case 'SELECT':
      // 检查所有 SELECT (包括子查询、联合查询) 是否都使用了 TOP N 语法
      // 正则匹配: 1.单行注释 2.多行注释 3.字符串 4.方括号标识符 5.SELECT关键字 6.TOP N (数字)
      const selectRegex = /(--[^\r\n]*)|(\/\*[\s\S]*?\*\/)|(N?'(?:''|[^'])*')|(\[[^\]]*\])|(\bSELECT\b)(?:\s+(?:DISTINCT|ALL))?(?:\s+TOP(?:\s+|\s*\(\s*)(\d+))?/gi;
      const matches = [...trimmedSql.matchAll(selectRegex)];
      for (const match of matches) {
        // 如果是注释、字符串或方括号标识符 跳过
        if (match[1] || match[2] || match[3] || match[4]) {
          continue;
        }
        // SELECT 语句匹配
        const topN = match[6];
        if (!topN) {
          return { valid: false, message: '所有查询(包括子查询、联合查询)必须包含 TOP N 语法' };
        }
        const n = parseInt(topN, 10);
        if (isNaN(n) || n <= 0) {
          return { valid: false, message: 'TOP N 中的 N 必须是一个正整数' };
        }
        if (n > 1000) {
          return { valid: false, message: `查询限制数量不能超过 1000 (检测到: ${n})` };
        }
      }
      break;
    case 'INSERT':
      // INSERT 语句不需要额外校验 因为错了就插入失败并且只能插入一条语句
      break;
  }
  return { valid: true, message: '验证通过' };
}

/** 移除WHERE子句后的干扰项 */
function removeSubsequentClauses(whereClause) {
  // 使用正则查找关键字,确保不匹配字符串或注释中的内容
  // Group 5 是我们要查找的截断关键字
  const regex = /(--[^\r\n]*)|(\/\*[\s\S]*?\*\/)|(N?'(?:''|[^'])*')|(\[[^\]]*\])|\b(ORDER\s+BY|GROUP\s+BY|HAVING)\b/gi;
  let match;
  while ((match = regex.exec(whereClause)) !== null) {
    if (match[5]) {
      return whereClause.substring(0, match.index).trim();
    }
  }
  return whereClause.trim();
}

/** 判断是否为恒真条件 */
function isAlwaysTrueCondition(whereClause) {
  if (!whereClause) return false;
  const upperClause = whereClause.toUpperCase();
  // 匹配常见的恒真条件
  // 移除了字符串自相等检查,因为它可能在某些场景下是合法的（例如 WHERE name = ''）
  const alwaysTruePatterns = [
    /\b1\s*=\s*1\b/,
    /\b2\s*>\s*1\b/,
    /\b0\s*=\s*0\b/,
    /N?'(?:''|[^'])*'\s*=\s*N?'(?:''|[^'])*'/, // 'a'='a' (支持包含特殊字符)
  ];
  for (const pattern of alwaysTruePatterns) {
    if (pattern.test(upperClause)) {
      return true;
    }
  }
  return false;
}