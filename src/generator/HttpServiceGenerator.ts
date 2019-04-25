import { getCamelCase, getKebabCase, getPascalCase } from '../uitls/caseUtils';
import { getTypeString } from '../uitls/classUtils';
import ClassGenerator from './ClassGenerator';
import { ApiData, Definition, HttpServiceGenerateData, ParametersData } from '../core';


export default class HttpServiceGenerator extends ClassGenerator {

    generate(data: HttpServiceGenerateData): void {
        super.generate(data);
    }

    /**
     * 获取依赖数组
     * @param apis
     */
    private apisToDependencies(apis: ApiData[] = []): string[] {
        const dependencies = apis.flatMap(api => {
            if (api.parameters) {
                const paramsDependence = api.parameters.flatMap(value => this.getDependence(value.type));
                const resultDependence = this.getDependence(api.result);
                return resultDependence.concat(paramsDependence);
            }
            return this.getDependence(api.result);
        });
        return [...new Set(dependencies)];
    }

    /**
     * 获取依赖数组
     * @param definitions
     */
    definitionsToDependencies(definitions: Definition[]  = []): string[] {
        const dependencies: string[] = [];
        definitions.forEach((definition)  => {
            dependencies.push(...this.getDependence(definition));
        });
        return [...new Set(dependencies)];
    }

    /**
     * 递归处理依赖
     * @param type
     * @return {string[]}
     */
    private getDependence(type: Definition): string[] {
        if (!type) {
            return [];
        }
        if (type.type === 'Array') {
            return this.getDependence(type.items);
        } else if (type.type === 'object' && type.properties) {
            return this.definitionsToDependencies(type.properties);
        } else if (type.ref) {
            return [type.ref];
        }
        return [];
    }

    getTemplateModel(data: HttpServiceGenerateData): any {
        const name = getPascalCase(data.prefix ? data.prefix + data.name : data.name).replace('Controller', '');
        const data2 = {
            ...data,
            name,
            filename: `${getKebabCase(name)}.service.ts`,
            dependencies: this.apisToDependencies(data.apis),
            apis: data.apis.map(value => {
                const params = value.parameters == null ? [] : value.parameters.map(subValue => {
                    return {
                        ...subValue,
                        typeString: getTypeString(subValue.type)
                    };
                });
                return {
                    ...value,
                    name: getCamelCase(value.name),
                    returnType: getTypeString(value.result),
                    params
                };
            }),
        };
        return {
            ...data2,
            bodyString() {
                const params: ParametersData[] = this.params;
                let str = '';
                if (this.method === 'get') {
                    str += '{';
                    str += params ? params.filter(value => value.in === 'query').map(value => value.name).join(', ') : '';
                    str += '}';
                    return str === '{}' ? '' : str;
                } else if (params && params.length === 1 && params[0].in === 'body') {
                    str += `${params[0].name}`;
                } else {
                    str += '{';
                    str += params ? params.filter((value: ParametersData) => value.in === 'body').map(value => value.name).join(', ') : '';
                    str += '}';
                }
                return str === '{}' ? '' : str;
            },
            queryString() {
                if (this.method === 'get') {
                    return '';
                }
                const params: ParametersData[] = this.params;
                let str = '{';
                str += params ? params.filter(value => value.in === 'query').map(value => value.name).join(', ') : '';
                str += '}';
                return str === '{}' ? '' : str;
            },
            pathString() {
                let str = '`';
                str += this.path.replace('{', '${');
                str += '`';
                return str;
            }
        };
    }

    getDependencies(data: HttpServiceGenerateData): string[] {
        return this.apisToDependencies(data.apis);
    }
}

