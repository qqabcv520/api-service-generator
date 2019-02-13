import axios from 'axios';
import { ApiData, Definition, EntityGenerateData, HttpServiceGenerateData } from '../core';
import Parser from './Parser';

export default class SwaggerParser implements Parser {
    private response: any = null;

    public constructor(private url: string) {

    }

    public async loadResponse() {
        try {
            this.response = await axios.get(this.url);
        } catch (e) {
            throw new Error('swagger接口请求失败：\n' + e);
        }
    }

    /**
     * 获取api数据
     */
    public async getApis(): Promise<HttpServiceGenerateData[]> {
        if (this.response == null) {
            await this.loadResponse();
        }
        return this.transformApis(this.response.data);
    }

    /**
     * 获取api实体类数据
     */
    public async getApiEntity(): Promise<EntityGenerateData[]> {
        if (this.response == null) {
            await this.loadResponse();
        }
        return this.transformEntity(this.response.data);
    }

    /**
     * 把swagger返回的对象转成需要的格式
     */
    public transformApis(data: any): HttpServiceGenerateData[] {

        const apis = this.pathsToApis(data.paths);
        return data.tags.map((tag: any) => {
            return {
                ...tag,
                apis: apis.filter((value) => value.tags.indexOf(tag.name) !== -1)
            };
        });
    }

    /**
     * 把swagger的path对象转成需要的格式
     */
    private pathsToApis(paths: any): Array<ApiData & { tags: string }> {
        const apis: Array<ApiData & { tags: string }> = [];
        Object.keys(paths).forEach((pathsKey) => {
            const methods = paths[pathsKey];
            Object.keys(methods).forEach((methodsKey) => {
                const method = methods[methodsKey];
                const api = {
                    ...method,
                    path: pathsKey,
                    method: methodsKey,
                    name: pathsKey,
                    result: this.definitionToType(method.responses['200'].schema),
                    description: method.summary,
                    parameters: method.parameters && method.parameters.map((value: any) => {
                        return {
                            ...value,
                            type: this.definitionToType(value.schema || value)
                        };
                    })
                };
                api.name = this.getApiName(api);
                apis.push(api);
            });
        });
        return apis;
    }

    /**
     * 根据API对象生成API名称
     */
    private getApiName(api: any) {
        const path = (api.path as string)
        .replace(/[\/_](\w)/g, ($, $1) => $1.toUpperCase())
        .replace(/[\/]?{(\w)/g, ($, $1) => '$' + $1)
        .replace('}', '');

        return api.method + path;
    }

    /**
     * 把swagger返回的对象转成需要的格式
     */
    private transformEntity(data: any): EntityGenerateData[] {
        return this.definitionsToTypes(data.definitions) as EntityGenerateData[];
    }

    /**
     * 把swagger的definitions对象转成需要的格式
     */
    private definitionsToTypes(definitions: any): Definition[] {
        const types: Definition[] = [];
        Object.keys(definitions).forEach((definitionKey) => {
            const definition = definitions[definitionKey];
            types.push({
                name: definitionKey.replace(/[«»](\w?)/g, ($, $1) => { // 首字母大写
                    return $1.toUpperCase();
                }),
                ...this.definitionToType(definition)
            });
        });
        return types;
    }

    /**
     * 把swagger的definitions对象转成需要的格式
     */
    private propertiesToTypes(properties: any): Definition[] {
        const types: Definition[] = [];
        Object.keys(properties).forEach((definitionKey) => {
            const definition = properties[definitionKey];
            types.push({
                name: definitionKey,
                ...this.definitionToType(definition)
            });
        });
        return types;
    }

    /**
     * 转换swagger的type
     */
    private definitionToType(definition: any): Definition {
        if (typeof definition === 'undefined') {
            return;
        }
        const type: any = {
            description: definition.description
        };
        if (definition.$ref) {
            type.ref = this.refToEntityName(definition.$ref);
            type.type = type.ref;
        } else if (definition.type === 'integer') {
            type.type = 'number';
        } else if (definition.type === 'array') {
            type.type = 'Array';
            if (definition.items) {
                type.items = this.definitionToType(definition.items);
            }
        } else if (definition.type === 'object' && definition.properties !== undefined) {
            type.type = 'object';
            type.properties = this.propertiesToTypes(definition.properties);
        } else if (definition.type === 'ref') {
            type.type = 'any';
        } else {
            type.type = definition.type;
        }
        return type;
    }


    /**
     * 引用路径转实体名
     */
    private refToEntityName(ref: string) {
        // 格式： #/definitions/SkuListing
        return ref.substring(ref.lastIndexOf('/') + 1).replace(/[«»](\w?)/g, ($, $1) => { // 首字母大写
            return $1.toUpperCase();
        });
    }


}
