/**
 * 短横线/下横线/帕斯卡 转 驼峰命名
 */
export function getCamelCase(str: string): string {
    const reg = /(^|-|_)(\w)/g;
    const reg2 = /^(\w)/g;
    return str.replace(reg, ($, $1, $2) => $2.toUpperCase())
    .replace(reg2, ($, $1) => $1.toLowerCase());
}

/**
 * 短横线/下横线/驼峰 转 帕斯卡命名
 */
export function getPascalCase(str: string): string {
    const reg = /(^|-|_)(\w)/g;
    return str.replace(reg, ($, $1, $2) => $2.toUpperCase());
}


/**
 * 驼峰/下横线/帕斯卡 转 短横线命名
 */
export function getKebabCase(str: string): string {
    const reg = /^(\w)/g;
    const reg2 = /([A-Z]|_)/g;
    return str.replace(reg, ($, $1) => $1.toLowerCase()).replace(reg2, ($, $1) => '-' + $1.toLowerCase())
        ;
}
