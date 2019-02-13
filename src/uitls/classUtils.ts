/**
 * 递归处理类型为字符串
 */
import { Definition } from '../core';

export function getTypeString(type: Definition): string {
    if (!type) {
        return 'any';
    }
    if (type.type === 'object' && type.properties) {
        return type.properties.reduce((x, y) => {
            return x + `${y.name}: ${getTypeString(y)}, `;
        }, '{') + '}';
    } else if (type.type === 'Array') {
        if (type.items) {
            return `Array<${getTypeString(type.items)}>`;
        } else {
            return 'Array<any>';
        }
    }
    return type.type;
}
