import 'core-js/es7/array';
import fse from 'fs-extra';
import micromatch from 'micromatch';
import { GeneratorConfig, loadConfig } from './config';
import { EntityGenerateData, HttpServiceGenerateData } from './core';
import EntityGenerator from './generator/EntityGenerator';
import HttpServiceGenerator from './generator/HttpServiceGenerator';
import SwaggerParser from './parser/SwaggerParser';
import { mkdirsSync } from './uitls/fsUtils';
import program from 'commander';

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
        const httpDependencies = modules.flatMap(module => {
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
                return httpServiceGenerator.getDependencies(excludedModule);
            }
            return [];
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

/**
 * 广度优先遍历，获取class的依赖
 * @param entityGenerator class生成器，用于解析entities依赖
 * @param dependencies  待获取的class
 * @param entities 描述class的对象
 * @return 依赖的class名数组
 */
function getDependencies(entityGenerator: EntityGenerator, dependencies: string[], entities: EntityGenerateData[]): string[] {

    let newDependencies = dependencies;  // 待搜索dependencies列表
    let mergeDependencies = dependencies; // 已搜索dependencies列表
    while (newDependencies.length > 0) {
        // 新增dependencies放进待搜索列表
        newDependencies = entities.filter((value) => newDependencies.includes(value.name)) // 获取newDependencies的entities
                                  .flatMap((value) => entityGenerator.getDependencies(value)) // 搜索待搜索dependencies列表
                                  .filter((value) => !mergeDependencies.includes(value)); // 不存在于已搜索dependencies，所以是新增dependencies
        mergeDependencies = mergeDependencies.concat(newDependencies); // 搜索过的放进已搜索dependencies列表
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
    return {
        ...module,
        apis: module.apis.filter((api) => {
            return includeList.some(value => {
                return matching(value.path, api.path)
                    && (value.methods == null || value.methods.includes(api.method));
            });
        })
    };
}

/**
 * 过滤掉不需要包含的api
 */
function exclude(module: HttpServiceGenerateData, excludeList: {path?: string; methods?: Array<string>}[]) {
    if (!excludeList || excludeList.length === 0) {
        return {...module};
    }
    return {
        ...module,
        apis: module.apis.filter((api) => {
            return !excludeList.some(value => {
                return matching(value.path, api.path)
                    && (value.methods == null || value.methods.includes(api.method));
            });
        })
    };
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


(async function() {


    program
    .version(require('../package.json').version, '-v, --version')  // tslint:disable-line
    .usage('[options]');

    program.option('-c, --config', '配置文件路径').parse(process.argv);

    console.log('生成中...');
    try {
        const config = loadConfig(program.config);
        await copyAssets(config);
        await generateService(config);
        console.log('生成完成');
    } catch (e) {
        console.error('生成失败');
        console.error(e);
    }
})();
