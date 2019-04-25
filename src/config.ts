import path from 'path';

export interface GeneratorConfig {
    path?: string; // 生成后保存路径
    servicePath?: string;
    entityPath?: string;
    serviceTemplatePath?: string;
    entityTemplatePath?: string;
    include?: { // 要生成的接口过滤
        path?: string;
        methods?: Array<'get' | 'post' | 'delete' | 'put' | 'options' | 'patch' | 'head'>;
    }[];
    exclude?: { // 不生成的接口过滤
        path?: string;
        methods?: Array<'get' | 'post' | 'delete' | 'put' | 'options' | 'patch' | 'head'>;
    }[];
    projects?: {
        url: string; // api请求路径
        token: string; // yApi token
        data: {
            baseUrl: string; // 生成http文件名baseURL名称
            prefix: string; // 生成http文件名前缀
        };
    }[];
    apiType: 'swagger' | 'yapi';
    assetsPath?: string;
}

const defaultConfigPath = 'generate.conf.js';

const defaultConfig: GeneratorConfig = {
    path: 'src/app/api',
    servicePath: '/http',
    entityPath: '/entity',
    projects: [],
    apiType: 'swagger',
    serviceTemplatePath: 'node_modules/api-service-generator/template/service.js',
    entityTemplatePath: 'node_modules/api-service-generator/template/entity.js',
    assetsPath: 'node_modules/api-service-generator/template/assets'
};


export function loadConfig(): GeneratorConfig {
    const configPath = process.argv[2] || defaultConfigPath;
    try {
        const userConfig: GeneratorConfig = require(path.join(process.cwd(), configPath));
        return {...defaultConfig, ...userConfig};
    } catch (e) {
        throw new Error('加载配置文件失败\n' + e);
    }
}
