import 'core-js/es7/array';
import fse from 'fs-extra';
import micromatch from 'micromatch';
import { GeneratorConfig, loadConfig } from './config';
import { EntityGenerateData, HttpServiceGenerateData } from './core';
import EntityGenerator from './generator/EntityGenerator';
import HttpServiceGenerator from './generator/HttpServiceGenerator';
import SwaggerParser from './parser/SwaggerParser';
import { copyFolder, mkdirsSync, rmdirsSync } from './uitls/fsUtils';



/**
 * 生成service
 */
export async function generateService(config: GeneratorConfig) {
    // rmdirsSync(config.path + config.servicePath);
    mkdirsSync(config.path + config.servicePath);
    // rmdirsSync(config.path + config.entityPath);
    mkdirsSync(config.path + config.entityPath);
    const httpServiceGenerator = new HttpServiceGenerator();
    for (const project of config.projects) {
        const parser = new SwaggerParser(project.url);
        const modules: HttpServiceGenerateData[] = await parser.getApis();
        let httpDependencies: string[] = [];
        modules.forEach((module) => {
            const includeModule = include(module, config.include);
            const excludedModule = exclude(includeModule, config.exclude);
            if (excludedModule.apis.length > 0) {
                const targetPath = config.path + config.servicePath;
                httpServiceGenerator.generate({
                    ...excludedModule,
                    data: project.data,
                    templatePath: config.serviceTemplatePath,
                    targetPath
                });
                httpDependencies = httpDependencies.concat(httpServiceGenerator.getDependencies(excludedModule));
            }
        });
        const entityGenerator = new EntityGenerator();
        const entities: EntityGenerateData[] = await parser.getApiEntity();
        const dependencies = getDependencies(entityGenerator, httpDependencies, entities);
        entities.filter((value) => dependencies.includes(value.name))
        .forEach((entity) => {
            const targetPath = config.path + config.entityPath;
            entityGenerator.generate({
                ...entity,
                data: project.data,
                templatePath: config.entityTemplatePath,
                targetPath
            });
        });
    }
}

function getDependencies(entityGenerator: EntityGenerator, dependencies: string[], entities: EntityGenerateData[]) {

    let newDependencies = dependencies;
    let mergeDependencies = dependencies;
    while (newDependencies.length > 0) {
        newDependencies = entities.filter((value) => newDependencies.includes(value.name)) // 获取newDependencies的entities
                .flatMap((value) => entityGenerator.getDependencies(value))
                .filter((value) => !mergeDependencies.includes(value)); // 不存在于原dependencies，所以是新增dependencies
        mergeDependencies = mergeDependencies.concat(newDependencies);
    }
    return mergeDependencies;
}

/**
 * 包含需要的api
 */
function include(module: HttpServiceGenerateData, includeList: {path?: string; methods?: Array<string>}[]) {
    if (!includeList || includeList.length === 0) {
        return {...module};
    }
    const newModule: HttpServiceGenerateData = {
        ...module,
        apis: []
    };
    module.apis.forEach((api) => {
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
 */
function exclude(module: HttpServiceGenerateData, excludeList: {path?: string; methods?: Array<string>}[]) {
    if (!excludeList || excludeList.length === 0) {
        return {...module};
    }
    const newModule: HttpServiceGenerateData = {
        ...module,
        apis: []
    };
    module.apis.forEach((api) => {
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
 */
function matching(reg: string, input: string) {
    return micromatch.isMatch(input, reg);
}

/**
 * 拷贝资源文件
 */
async function copyAssets(config: GeneratorConfig) {
    if (!config.assetsPath || config.assetsPath.length === 0) {
        return;
    }
    try {
        mkdirsSync(config.path);
        await fse.copy(config.assetsPath, config.path, { overwrite: true });
    } catch (e) {
        throw new Error('拷贝assets文件失败：\n' + e);
    }
}


(async () => {
    console.log('生成中...');
    try {
        const config = loadConfig();
        await copyAssets(config);
        await generateService(config);
        console.log('生成完成');
    } catch (e) {
        console.error('生成失败');
        console.error(e);
    }
})();
