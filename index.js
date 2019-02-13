'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

require('core-js/es7/array');
var micromatch = _interopDefault(require('micromatch'));
var fs = _interopDefault(require('fs'));
var path = require('path');
var path__default = _interopDefault(path);
var axios = _interopDefault(require('axios'));
var Mustache = _interopDefault(require('mustache'));
var fse = _interopDefault(require('fs-extra'));

/*! *****************************************************************************
Copyright (c) Microsoft Corporation. All rights reserved.
Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at http://www.apache.org/licenses/LICENSE-2.0

THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
MERCHANTABLITY OR NON-INFRINGEMENT.

See the Apache Version 2.0 License for specific language governing permissions
and limitations under the License.
***************************************************************************** */

function __awaiter(thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

function mkdirsSync(dirPath) {
    if (fs.existsSync(dirPath)) {
        return true;
    }
    else {
        if (mkdirsSync(path__default.dirname(dirPath))) {
            fs.mkdirSync(dirPath);
            return true;
        }
    }
}

class SwaggerParser {
    constructor(url) {
        this.url = url;
        this.response = null;
    }
    loadResponse() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.response = yield axios.get(this.url);
            }
            catch (e) {
                throw new Error('swagger接口请求失败：\n' + e);
            }
        });
    }
    /**
     * 获取api数据
     */
    getApis() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.response == null) {
                yield this.loadResponse();
            }
            return this.transformApis(this.response.data);
        });
    }
    /**
     * 获取api实体类数据
     */
    getApiEntity() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.response == null) {
                yield this.loadResponse();
            }
            return this.transformEntity(this.response.data);
        });
    }
    /**
     * 把swagger返回的对象转成需要的格式
     */
    transformApis(data) {
        const apis = this.pathsToApis(data.paths);
        return data.tags.map((tag) => {
            return Object.assign({}, tag, { apis: apis.filter(value => value.tags.indexOf(tag.name) !== -1) });
        });
    }
    /**
     * 把swagger的path对象转成需要的格式
     */
    pathsToApis(paths) {
        const apis = [];
        Object.keys(paths).forEach(pathsKey => {
            const methods = paths[pathsKey];
            Object.keys(methods).forEach(methodsKey => {
                const method = methods[methodsKey];
                const api = Object.assign({}, method, { path: pathsKey, method: methodsKey, name: pathsKey, result: this.definitionToType(method.responses['200'].schema), description: method.summary, parameters: method.parameters && method.parameters.map((value) => {
                        return Object.assign({}, value, { type: this.definitionToType(value.schema || value) });
                    }) });
                api.name = this.getApiName(api);
                apis.push(api);
            });
        });
        return apis;
    }
    /**
     * 根据API对象生成API名称
     */
    getApiName(api) {
        const path$$1 = api.path
            .replace(/[\/_](\w)/g, ($, $1) => $1.toUpperCase())
            .replace(/[\/]?{(\w)/g, ($, $1) => '$' + $1)
            .replace('}', '');
        return api.method + path$$1;
    }
    /**
     * 把swagger返回的对象转成需要的格式
     */
    transformEntity(data) {
        return this.definitionsToTypes(data.definitions);
    }
    /**
     * 把swagger的definitions对象转成需要的格式
     */
    definitionsToTypes(definitions) {
        const types = [];
        Object.keys(definitions).forEach(definitionKey => {
            const definition = definitions[definitionKey];
            types.push(Object.assign({ name: definitionKey.replace(/[«»](\w?)/g, ($, $1) => {
                    return $1.toUpperCase();
                }) }, this.definitionToType(definition)));
        });
        return types;
    }
    /**
     * 把swagger的definitions对象转成需要的格式
     */
    propertiesToTypes(properties) {
        const types = [];
        Object.keys(properties).forEach(definitionKey => {
            const definition = properties[definitionKey];
            types.push(Object.assign({ name: definitionKey }, this.definitionToType(definition)));
        });
        return types;
    }
    /**
     * 转换swagger的type
     */
    definitionToType(definition) {
        if (typeof definition === 'undefined') {
            return;
        }
        const type = {
            description: definition.description,
        };
        if (definition.$ref) {
            type.ref = this.refToEntityName(definition.$ref);
            type.type = type.ref;
        }
        else if (definition.type === 'integer') {
            type.type = 'number';
        }
        else if (definition.type === 'array') {
            type.type = 'Array';
            if (definition.items) {
                type.items = this.definitionToType(definition.items);
            }
        }
        else if (definition.type === 'object' && definition.properties !== undefined) {
            type.type = 'object';
            type.properties = this.propertiesToTypes(definition.properties);
        }
        else if (definition.type === 'ref') {
            type.type = 'any';
        }
        else {
            type.type = definition.type;
        }
        return type;
    }
    /**
     * 引用路径转实体名
     */
    refToEntityName(ref) {
        // 格式： #/definitions/SkuListing
        return ref.substring(ref.lastIndexOf('/') + 1).replace(/[«»](\w?)/g, ($, $1) => {
            return $1.toUpperCase();
        });
    }
}

/**
 * 短横线/下横线/帕斯卡 转 驼峰命名
 * @param {string} str
 * @return {string}
 */
function getCamelCase(str) {
    const reg = /(^|-|_)(\w)/g;
    const reg2 = /^(\w)/g;
    return str.replace(reg, ($, $1, $2) => $2.toUpperCase())
        .replace(reg2, ($, $1) => $1.toLowerCase());
}
/**
 * 短横线/下横线/驼峰 转 帕斯卡命名
 * @param {string} str
 * @return {string}
 */
function getPascalCase(str) {
    const reg = /(^|-|_)(\w)/g;
    return str.replace(reg, ($, $1, $2) => $2.toUpperCase());
}
/**
 * 驼峰/下横线/帕斯卡 转 短横线命名
 * @param {string} str
 * @return {string}
 */
function getKebabCase(str) {
    const reg = /^(\w)/g;
    const reg2 = /([A-Z]|_)/g;
    return str.replace(reg, ($, $1) => $1.toLowerCase()).replace(reg2, ($, $1) => '-' + $1.toLowerCase());
}

/**
 * 递归处理类型为字符串
 * @param type
 * @return {string}
 */
function getTypeString(type) {
    if (!type) {
        return 'any';
    }
    if (type.type === 'object' && type.properties) {
        return type.properties.reduce((x, y) => {
            return x + `${y.name}: ${getTypeString(y)}, `;
        }, '{') + '}';
    }
    else if (type.type === 'Array') {
        if (type.items) {
            return `Array<${getTypeString(type.items)}>`;
        }
        else {
            return `Array<any>`;
        }
    }
    return type.type;
}

class FileGenerator {
    generate(data) {
        const templateModel = this.getTemplateModel(data);
        const content = Mustache.render(require(path.join(process.cwd(), data.templatePath)), templateModel);
        this.writeFile(data.targetPath, templateModel.filename, content);
    }
    writeFile(targetPath, filename, content) {
        mkdirsSync(targetPath);
        fs.writeFileSync(path.join(targetPath, filename), content);
    }
}

class ClassGenerator extends FileGenerator {
}

class HttpServiceGenerator extends ClassGenerator {
    generate(data) {
        super.generate(data);
    }
    /**
     * 获取依赖数组
     * @param apis
     */
    apisToDependencies(apis = []) {
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
    definitionsToDependencies(definitions = []) {
        const dependencies = [];
        definitions.forEach((definition) => {
            dependencies.push(...this.getDependence(definition));
        });
        return [...new Set(dependencies)];
    }
    /**
     * 递归处理依赖
     * @param type
     * @return {string[]}
     */
    getDependence(type) {
        if (!type) {
            return [];
        }
        if (type.type === 'Array') {
            return this.getDependence(type.items);
        }
        else if (type.type === 'object' && type.properties) {
            return this.definitionsToDependencies(type.properties);
        }
        else if (type.ref) {
            return [type.ref];
        }
        return [];
    }
    getTemplateModel(data) {
        const name = getPascalCase(data.prefix ? data.prefix + data.name : data.name).replace('Controller', '');
        const data2 = Object.assign({}, data, { name, filename: `${getKebabCase(name)}.service.ts`, dependencies: this.apisToDependencies(data.apis), apis: data.apis.map(value => {
                let params = [];
                if (value.parameters) {
                    params = value.parameters.map(subValue => {
                        return Object.assign({}, subValue, { typeString: getTypeString(subValue.type) });
                    });
                }
                return Object.assign({}, value, { name: getCamelCase(value.name), returnType: getTypeString(value.result), params });
            }) });
        return Object.assign({}, data2, { bodyString() {
                const params = this.params;
                let str = '';
                if (params && params.length === 1 && params[0].in === 'body') {
                    str += `${params[0].name}`;
                }
                else {
                    str += '{';
                    str += params ? params.filter((value) => value.in === 'body').map(value => value.name).join(', ') : '';
                    str += '}';
                }
                return str === '{}' ? '' : str;
            },
            queryString() {
                const params = this.params;
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
            } });
    }
    getDependencies(data) {
        return this.apisToDependencies(data.apis);
    }
}

class EntityGenerator extends ClassGenerator {
    generate(data) {
        super.generate(data);
    }
    /**
     * 递归处理类型为字符串
     * @param type
     * @return
     */
    getTypeString(type) {
        if (type.type === 'object' && type.properties) {
            return type.properties.reduce((x, y) => {
                return x + `${y.name}: ${this.getTypeString(y)}, `;
            }, '{') + '}';
        }
        else if (type.type === 'Array') {
            if (type.items) {
                return `Array<${this.getTypeString(type.items)}>`;
            }
            else {
                return `Array<any>`;
            }
        }
        return type.type;
    }
    getDependencies(data) {
        return this.definitionToDependencies(data.properties);
    }
    /**
     * 获取依赖数组
     * @param properties
     * @return
     */
    definitionToDependencies(properties = []) {
        const dependencies = properties.flatMap(value => this.getDependence(value));
        return [...new Set(dependencies)];
    }
    /**
     * 递归处理依赖
     * @param type
     * @return {string[]}
     */
    getDependence(type) {
        if (type.type === 'Array') {
            return this.getDependence(type.items);
        }
        else if (type.type === 'object' && type.properties) {
            return this.definitionToDependencies(type.properties);
        }
        else if (type.ref) {
            return [type.ref];
        }
        return [];
    }
    getTemplateModel(data) {
        const name = getPascalCase(data.name);
        return {
            name,
            filename: `${name}.ts`,
            properties: data.properties && data.properties.map(value => {
                return Object.assign({}, value, { typeStr: this.getTypeString(value) });
            }),
            dependencies: this.getDependencies(data).filter(value => value !== data.name)
        };
    }
}

const defaultConfigPath = 'generate.conf.js';
const defaultConfig = {
    path: 'src/app/api',
    servicePath: '/http',
    entityPath: '/entity',
    projects: [],
    apiType: 'swagger',
    serviceTemplatePath: 'node_modules/api-service-generator/template/service.js',
    entityTemplatePath: 'node_modules/api-service-generator/template/entity.js',
    assetsPath: 'node_modules/api-service-generator/template/assets',
};
function loadConfig() {
    const configPath = process.argv[2] || defaultConfigPath;
    try {
        const userConfig = require(path__default.join(process.cwd(), configPath));
        return Object.assign({}, defaultConfig, userConfig);
    }
    catch (e) {
        throw new Error('加载配置文件失败\n' + e);
    }
}

/**
 * 生成service
 * @return {Promise<void>}
 */
function generateService(config) {
    return __awaiter(this, void 0, void 0, function* () {
        // rmdirsSync(config.path + config.servicePath);
        mkdirsSync(config.path + config.servicePath);
        // rmdirsSync(config.path + config.entityPath);
        mkdirsSync(config.path + config.entityPath);
        const httpServiceGenerator = new HttpServiceGenerator();
        for (const project of config.projects) {
            const parser = new SwaggerParser(project.url);
            const modules = yield parser.getApis();
            let httpDependencies = [];
            modules.forEach(module => {
                const includeModule = include(module, config.include);
                const excludedModule = exclude(includeModule, config.exclude);
                if (excludedModule.apis.length > 0) {
                    const targetPath = config.path + config.servicePath;
                    httpServiceGenerator.generate(Object.assign({}, excludedModule, { data: project.data, templatePath: config.serviceTemplatePath, targetPath }));
                    httpDependencies = httpDependencies.concat(httpServiceGenerator.getDependencies(excludedModule));
                }
            });
            const entityGenerator = new EntityGenerator();
            const entities = yield parser.getApiEntity();
            const dependencies = getDependencies(entityGenerator, httpDependencies, entities);
            entities.filter(value => dependencies.includes(value.name))
                .forEach(entity => {
                const targetPath = config.path + config.entityPath;
                entityGenerator.generate(Object.assign({}, entity, { data: project.data, templatePath: config.entityTemplatePath, targetPath }));
            });
        }
    });
}
function getDependencies(entityGenerator, dependencies, entities) {
    let newDependencies = dependencies;
    let mergeDependencies = dependencies;
    while (newDependencies.length > 0) {
        newDependencies = entities.filter(value => newDependencies.includes(value.name)) // 获取newDependencies的entities
            .flatMap(value => entityGenerator.getDependencies(value))
            .filter(value => !mergeDependencies.includes(value)); // 不存在于原dependencies，所以是新增dependencies
        mergeDependencies = mergeDependencies.concat(newDependencies);
    }
    return mergeDependencies;
}
/**
 * 包含需要的api
 * @param module
 * @param includeList
 */
function include(module, includeList) {
    if (!includeList || includeList.length === 0) {
        return Object.assign({}, module);
    }
    const newModule = Object.assign({}, module, { apis: [] });
    module.apis.forEach(api => {
        for (const value of includeList) {
            if (matching(value.path, `${api.path}`)) { // 路径匹配
                if (value.methods == null || value.methods.includes(api.method)) { // 请求方法匹配
                    newModule.apis.push(api);
                }
            }
        }
    });
    return newModule;
}
/**
 * 过滤掉不需要包含的api
 * @param module
 * @param excludeList
 */
function exclude(module, excludeList) {
    if (!excludeList || excludeList.length === 0) {
        return Object.assign({}, module);
    }
    const newModule = Object.assign({}, module, { apis: [] });
    module.apis.forEach(api => {
        let flag = true;
        for (const value of excludeList) {
            if (matching(value.path, `${api.path}`)) {
                if (value.methods == null || value.methods.includes(api.method)) {
                    flag = false;
                    break;
                }
            }
        }
        if (flag) {
            newModule.apis.push(api);
        }
    });
    return newModule;
}
/**
 * 路径匹配
 * @param reg
 * @param input
 * @return {boolean}
 */
function matching(reg, input) {
    return micromatch.isMatch(input, reg);
}
/**
 * 拷贝资源文件
 * @param config
 */
function copyAssets(config) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!config.assetsPath || config.assetsPath.length === 0) {
            return;
        }
        try {
            mkdirsSync(config.path);
            yield fse.copy(config.assetsPath, config.path, { overwrite: true });
        }
        catch (e) {
            throw new Error('拷贝assets文件失败：\n' + e);
        }
    });
}
(() => __awaiter(undefined, void 0, void 0, function* () {
    console.log('生成中...');
    try {
        const config = loadConfig();
        yield copyAssets(config);
        yield generateService(config);
        console.log('生成完成');
    }
    catch (e) {
        console.error('生成失败');
        console.error(e);
    }
}))();

exports.generateService = generateService;
