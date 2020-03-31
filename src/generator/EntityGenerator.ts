import { Definition, EntityGenerateData } from '../core';
import { getUpperCamelCase } from '../uitls/caseUtils';
import ClassGenerator from './ClassGenerator';


export default class EntityGenerator extends ClassGenerator {

    public generate(data: EntityGenerateData): void {
        super.generate(data);
    }

    /**
     * 递归处理类型为字符串
     * @param type
     * @return
     */
    private getTypeString(type: Definition): string {
        if (type.type === 'object' && type.properties) {
            return type.properties.reduce((x, y) => {
                return x + `${y.name}: ${this.getTypeString(y)}, `;
            }, '{') + '}';
        } else if (type.type === 'Array') {
            if (type.items) {
                return `Array<${this.getTypeString(type.items)}>`;
            } else {
                return 'Array<any>';
            }
        }
        return type.type;
    }

    public getDependencies(data: EntityGenerateData): string[] {
        return this.definitionToDependencies(data.properties);
    }

    /**
     * 获取依赖数组
     * @param properties
     * @return
     */
    private definitionToDependencies(properties: Definition[] = []): string[] {
        const dependencies = properties.flatMap((value) => this.getDependence(value));
        return [...new Set(dependencies)];
    }

    /**
     * 递归处理依赖
     * @param type
     * @return {string[]}
     */
    private getDependence(type: Definition): string[] {
        if (type.type === 'Array') {
            return this.getDependence(type.items);
        } else if (type.type === 'object' && type.properties) {
            return this.definitionToDependencies(type.properties);
        } else if (type.ref) {
            return [type.ref];
        }
        return [];
    }

    public getTemplateModel(data: EntityGenerateData): any {
        return {
            name: data.name,
            description: data.description,
            filename: `${data.name}.ts`,
            properties: data.properties && data.properties.map((value) => {
                return {
                    ...value,
                    typeStr: this.getTypeString(value)
                };
            }),
            dependencies: this.getDependencies(data).filter((value) => value !== data.name)
        };
    }
}


