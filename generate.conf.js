
module.exports = {
    path: './example', //生成后保存路径
    // serviceTemplatePath: 'node_modules/api-service-generator/template/service.js',
    // entityTemplatePath: 'node_modules/api-service-generator/template/entity.js',
    serviceTemplatePath: './template/service.js',
    entityTemplatePath: './template/entity.js',
    include: [
        {path: '**'},
    ], // 包含需要生产的接口
    // exclude: [
    //     {path: '**', methods: ['delete', 'put', 'options', 'patch', 'head']},
    //     {path: '/error'},
    // ], // 不生成的接口过滤，会覆盖include配置
    projects: [
        {
            url: 'http://192.168.1.146:8520/v2/api-docs',
            data: {
                baseUrl: 'common',
                prefix: 'abc'
            }
        },
    ],
    assetsPath: './template/assets',
};
