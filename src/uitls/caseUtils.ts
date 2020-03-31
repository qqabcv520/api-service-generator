/**
 * 短横线/下划线/小驼峰 转 大驼峰命名(UpperCamelCase)
 */
export function getUpperCamelCase(str: string): string {
    const reg = /(^|-|_)(\w)/g;
    return str.replace(reg, ($, $1, $2) => $2.toUpperCase());
}

/**
 * 短横线/下横线/大驼峰 转 小驼峰命名(lowerCamelCase)
 */
export function getLowerCamelCase(str: string): string {
    const reg = /(^|-|_)(\w)/g;
    const reg2 = /^(\w)/g;
    return str.replace(reg, ($, $1, $2) => $2.toUpperCase())
    .replace(reg2, ($, $1) => $1.toLowerCase());
}

/**
 * 驼峰/下划线 转 短横线命名(kebab-case)
 */
export function getKebabCase(str: string): string {
    const reg = /^([A-Z$]+)/g;
    const reg2 = /_([a-zA-Z$]+)/g;
    const reg3 = /([A-Z$]+)/g;
    return str.replace(reg, ($, $1) => $1.toLowerCase())
    .replace(reg2, ($, $1) => '-' + $1.toLowerCase())
    .replace(reg3, ($, $1) => '-' + $1.toLowerCase());
}


/**
 * 驼峰/短横线 转 下划线命名(under_score_case)
 */
export function getUnderScoreCase(str: string): string {
    const reg = /^([A-Z$]+)/g;
    const reg2 = /-([a-zA-Z$]+)/g;
    const reg3 = /([A-Z$]+)/g;
    return str.replace(reg, ($, $1) => $1.toLowerCase())
    .replace(reg2, ($, $1) => '_' + $1.toLowerCase())
    .replace(reg3, ($, $1) => '_' + $1.toLowerCase());
}

