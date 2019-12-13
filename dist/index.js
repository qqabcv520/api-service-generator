'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

require('core-js/es7/array');
var fse = _interopDefault(require('fs-extra'));
var micromatch = _interopDefault(require('micromatch'));
var path = require('path');
var path__default = _interopDefault(path);
var fs = _interopDefault(require('fs'));
var Mustache = _interopDefault(require('mustache'));
var axios = _interopDefault(require('axios'));
var events = _interopDefault(require('events'));
var child_process = _interopDefault(require('child_process'));
var util = _interopDefault(require('util'));

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

const defaultConfigPath = 'generate.conf.js';
const defaultConfig = {
    path: 'src/app/api',
    servicePath: '/http',
    entityPath: '/entity',
    projects: [],
    apiType: 'swagger',
    serviceTemplatePath: 'node_modules/api-service-generator/template/service.js',
    entityTemplatePath: 'node_modules/api-service-generator/template/entity.js',
    assetsPath: 'node_modules/api-service-generator/template/assets'
};
function loadConfig(configPath = defaultConfigPath) {
    const absolutePath = path__default.join(process.cwd(), configPath);
    try {
        const userConfig = require(absolutePath);
        return Object.assign({}, defaultConfig, userConfig);
    }
    catch (e) {
        throw new Error(`加载配置文件失败:${absolutePath}\n' ${e}`);
    }
}

/**
 * 短横线/下横线/帕斯卡 转 驼峰命名
 */
function getCamelCase(str) {
    const reg = /(^|-|_)(\w)/g;
    const reg2 = /^(\w)/g;
    return str.replace(reg, ($, $1, $2) => $2.toUpperCase())
        .replace(reg2, ($, $1) => $1.toLowerCase());
}
/**
 * 短横线/下横线/驼峰 转 帕斯卡命名
 */
function getPascalCase(str) {
    const reg = /(^|-|_)(\w)/g;
    return str.replace(reg, ($, $1, $2) => $2.toUpperCase());
}
/**
 * 驼峰/下横线/帕斯卡 转 短横线命名
 */
function getKebabCase(str) {
    const reg = /^(\w)/g;
    const reg2 = /([A-Z]|_)/g;
    return str.replace(reg, ($, $1) => $1.toLowerCase()).replace(reg2, ($, $1) => '-' + $1.toLowerCase());
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
                return 'Array<any>';
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
        const dependencies = properties.flatMap((value) => this.getDependence(value));
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
            properties: data.properties && data.properties.map((value) => {
                return Object.assign({}, value, { typeStr: this.getTypeString(value) });
            }),
            dependencies: this.getDependencies(data).filter((value) => value !== data.name)
        };
    }
}

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
            return 'Array<any>';
        }
    }
    return type.type;
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
                const params = value.parameters == null ? [] : value.parameters
                    .filter(subValue => subValue.in === 'body' || subValue.in === 'path' || subValue.in === 'query').map(subValue => {
                    return Object.assign({}, subValue, { typeString: getTypeString(subValue.type) });
                });
                return Object.assign({}, value, { name: getCamelCase(value.name), returnType: getTypeString(value.result), params });
            }) });
        return Object.assign({}, data2, { bodyString() {
                const params = this.params;
                const queryParams = params ? params.filter((value) => value.in === 'query') : [];
                const bodyParams = params ? params.filter((value) => value.in === 'body') : [];
                let str = '';
                if (this.method === 'get') {
                    str += '{';
                    str += queryParams.map(value => value.name).join(', ');
                    str += '}';
                    return str === '{}' ? '' : str;
                }
                else if (bodyParams && bodyParams.length === 1 && bodyParams[0].in === 'body') {
                    str += `${bodyParams[0].name}`;
                }
                else {
                    str += '{';
                    str += bodyParams.map(value => value.name).join(', ');
                    str += '}';
                }
                return str === '{}' ? '' : str;
            },
            queryString() {
                if (this.method === 'get') {
                    return '';
                }
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
            return Object.assign({}, tag, { apis: apis.filter((value) => value.tags.indexOf(tag.name) !== -1) });
        });
    }
    /**
     * 把swagger的path对象转成需要的格式
     */
    pathsToApis(paths) {
        return Object.keys(paths).flatMap(pathsKey => {
            const methods = paths[pathsKey];
            return Object.keys(methods).map((methodsKey) => {
                const method = methods[methodsKey];
                return Object.assign({}, method, { path: pathsKey, method: methodsKey, name: this.getApiName(pathsKey, methodsKey), result: this.definitionToType(method.responses['200'].schema), description: method.summary, parameters: method.parameters && method.parameters.map((value) => {
                        return Object.assign({}, value, { type: this.definitionToType(value.schema || value) });
                    }) });
            });
        });
    }
    /**
     * 根据API对象生成API名称
     */
    getApiName(path, method) {
        const name = path.replace(/[\/_](\w)/g, ($, $1) => $1.toUpperCase())
            .replace(/[\/]?{(\w)/g, ($, $1) => '$' + $1)
            .replace('}', '');
        return method + name;
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
        return Object.keys(definitions).map((definitionKey) => {
            const definition = definitions[definitionKey];
            return Object.assign({ name: definitionKey.replace(/[«»](\w?)/g, ($, $1) => {
                    return $1.toUpperCase();
                }) }, this.definitionToType(definition));
        });
    }
    /**
     * 把swagger的definitions对象转成需要的格式
     */
    propertiesToTypes(properties) {
        return Object.keys(properties).map((definitionKey) => {
            const definition = properties[definitionKey];
            return Object.assign({ name: definitionKey }, this.definitionToType(definition));
        });
    }
    /**
     * 转换swagger的type
     */
    definitionToType(definition) {
        if (typeof definition === 'undefined') {
            return;
        }
        const type = {
            description: definition.description
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
            type.type = 'any';
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

function createCommonjsModule(fn, module) {
	return module = { exports: {} }, fn(module, module.exports), module.exports;
}

var D__code_apiServiceGenerator_node_modules_commander = createCommonjsModule(function (module, exports) {
/**
 * Module dependencies.
 */

var EventEmitter = events.EventEmitter;
var spawn = child_process.spawn;

var dirname = path__default.dirname;
var basename = path__default.basename;


/**
 * Inherit `Command` from `EventEmitter.prototype`.
 */

util.inherits(Command, EventEmitter);

/**
 * Expose the root command.
 */

exports = module.exports = new Command();

/**
 * Expose `Command`.
 */

exports.Command = Command;

/**
 * Expose `Option`.
 */

exports.Option = Option;

/**
 * Initialize a new `Option` with the given `flags` and `description`.
 *
 * @param {String} flags
 * @param {String} description
 * @api public
 */

function Option(flags, description) {
  this.flags = flags;
  this.required = flags.indexOf('<') >= 0;
  this.optional = flags.indexOf('[') >= 0;
  this.bool = flags.indexOf('-no-') === -1;
  flags = flags.split(/[ ,|]+/);
  if (flags.length > 1 && !/^[[<]/.test(flags[1])) this.short = flags.shift();
  this.long = flags.shift();
  this.description = description || '';
}

/**
 * Return option name.
 *
 * @return {String}
 * @api private
 */

Option.prototype.name = function() {
  return this.long
    .replace('--', '')
    .replace('no-', '');
};

/**
 * Return option name, in a camelcase format that can be used
 * as a object attribute key.
 *
 * @return {String}
 * @api private
 */

Option.prototype.attributeName = function() {
  return camelcase(this.name());
};

/**
 * Check if `arg` matches the short or long flag.
 *
 * @param {String} arg
 * @return {Boolean}
 * @api private
 */

Option.prototype.is = function(arg) {
  return this.short === arg || this.long === arg;
};

/**
 * Initialize a new `Command`.
 *
 * @param {String} name
 * @api public
 */

function Command(name) {
  this.commands = [];
  this.options = [];
  this._execs = {};
  this._allowUnknownOption = false;
  this._args = [];
  this._name = name || '';
}

/**
 * Add command `name`.
 *
 * The `.action()` callback is invoked when the
 * command `name` is specified via __ARGV__,
 * and the remaining arguments are applied to the
 * function for access.
 *
 * When the `name` is "*" an un-matched command
 * will be passed as the first arg, followed by
 * the rest of __ARGV__ remaining.
 *
 * Examples:
 *
 *      program
 *        .version('0.0.1')
 *        .option('-C, --chdir <path>', 'change the working directory')
 *        .option('-c, --config <path>', 'set config path. defaults to ./deploy.conf')
 *        .option('-T, --no-tests', 'ignore test hook')
 *
 *      program
 *        .command('setup')
 *        .description('run remote setup commands')
 *        .action(function() {
 *          console.log('setup');
 *        });
 *
 *      program
 *        .command('exec <cmd>')
 *        .description('run the given remote command')
 *        .action(function(cmd) {
 *          console.log('exec "%s"', cmd);
 *        });
 *
 *      program
 *        .command('teardown <dir> [otherDirs...]')
 *        .description('run teardown commands')
 *        .action(function(dir, otherDirs) {
 *          console.log('dir "%s"', dir);
 *          if (otherDirs) {
 *            otherDirs.forEach(function (oDir) {
 *              console.log('dir "%s"', oDir);
 *            });
 *          }
 *        });
 *
 *      program
 *        .command('*')
 *        .description('deploy the given env')
 *        .action(function(env) {
 *          console.log('deploying "%s"', env);
 *        });
 *
 *      program.parse(process.argv);
  *
 * @param {String} name
 * @param {String} [desc] for git-style sub-commands
 * @return {Command} the new command
 * @api public
 */

Command.prototype.command = function(name, desc, opts) {
  if (typeof desc === 'object' && desc !== null) {
    opts = desc;
    desc = null;
  }
  opts = opts || {};
  var args = name.split(/ +/);
  var cmd = new Command(args.shift());

  if (desc) {
    cmd.description(desc);
    this.executables = true;
    this._execs[cmd._name] = true;
    if (opts.isDefault) this.defaultExecutable = cmd._name;
  }
  cmd._noHelp = !!opts.noHelp;
  this.commands.push(cmd);
  cmd.parseExpectedArgs(args);
  cmd.parent = this;

  if (desc) return this;
  return cmd;
};

/**
 * Define argument syntax for the top-level command.
 *
 * @api public
 */

Command.prototype.arguments = function(desc) {
  return this.parseExpectedArgs(desc.split(/ +/));
};

/**
 * Add an implicit `help [cmd]` subcommand
 * which invokes `--help` for the given command.
 *
 * @api private
 */

Command.prototype.addImplicitHelpCommand = function() {
  this.command('help [cmd]', 'display help for [cmd]');
};

/**
 * Parse expected `args`.
 *
 * For example `["[type]"]` becomes `[{ required: false, name: 'type' }]`.
 *
 * @param {Array} args
 * @return {Command} for chaining
 * @api public
 */

Command.prototype.parseExpectedArgs = function(args) {
  if (!args.length) return;
  var self = this;
  args.forEach(function(arg) {
    var argDetails = {
      required: false,
      name: '',
      variadic: false
    };

    switch (arg[0]) {
      case '<':
        argDetails.required = true;
        argDetails.name = arg.slice(1, -1);
        break;
      case '[':
        argDetails.name = arg.slice(1, -1);
        break;
    }

    if (argDetails.name.length > 3 && argDetails.name.slice(-3) === '...') {
      argDetails.variadic = true;
      argDetails.name = argDetails.name.slice(0, -3);
    }
    if (argDetails.name) {
      self._args.push(argDetails);
    }
  });
  return this;
};

/**
 * Register callback `fn` for the command.
 *
 * Examples:
 *
 *      program
 *        .command('help')
 *        .description('display verbose help')
 *        .action(function() {
 *           // output help here
 *        });
 *
 * @param {Function} fn
 * @return {Command} for chaining
 * @api public
 */

Command.prototype.action = function(fn) {
  var self = this;
  var listener = function(args, unknown) {
    // Parse any so-far unknown options
    args = args || [];
    unknown = unknown || [];

    var parsed = self.parseOptions(unknown);

    // Output help if necessary
    outputHelpIfNecessary(self, parsed.unknown);

    // If there are still any unknown options, then we simply
    // die, unless someone asked for help, in which case we give it
    // to them, and then we die.
    if (parsed.unknown.length > 0) {
      self.unknownOption(parsed.unknown[0]);
    }

    // Leftover arguments need to be pushed back. Fixes issue #56
    if (parsed.args.length) args = parsed.args.concat(args);

    self._args.forEach(function(arg, i) {
      if (arg.required && args[i] == null) {
        self.missingArgument(arg.name);
      } else if (arg.variadic) {
        if (i !== self._args.length - 1) {
          self.variadicArgNotLast(arg.name);
        }

        args[i] = args.splice(i);
      }
    });

    // Always append ourselves to the end of the arguments,
    // to make sure we match the number of arguments the user
    // expects
    if (self._args.length) {
      args[self._args.length] = self;
    } else {
      args.push(self);
    }

    fn.apply(self, args);
  };
  var parent = this.parent || this;
  var name = parent === this ? '*' : this._name;
  parent.on('command:' + name, listener);
  if (this._alias) parent.on('command:' + this._alias, listener);
  return this;
};

/**
 * Define option with `flags`, `description` and optional
 * coercion `fn`.
 *
 * The `flags` string should contain both the short and long flags,
 * separated by comma, a pipe or space. The following are all valid
 * all will output this way when `--help` is used.
 *
 *    "-p, --pepper"
 *    "-p|--pepper"
 *    "-p --pepper"
 *
 * Examples:
 *
 *     // simple boolean defaulting to false
 *     program.option('-p, --pepper', 'add pepper');
 *
 *     --pepper
 *     program.pepper
 *     // => Boolean
 *
 *     // simple boolean defaulting to true
 *     program.option('-C, --no-cheese', 'remove cheese');
 *
 *     program.cheese
 *     // => true
 *
 *     --no-cheese
 *     program.cheese
 *     // => false
 *
 *     // required argument
 *     program.option('-C, --chdir <path>', 'change the working directory');
 *
 *     --chdir /tmp
 *     program.chdir
 *     // => "/tmp"
 *
 *     // optional argument
 *     program.option('-c, --cheese [type]', 'add cheese [marble]');
 *
 * @param {String} flags
 * @param {String} description
 * @param {Function|*} [fn] or default
 * @param {*} [defaultValue]
 * @return {Command} for chaining
 * @api public
 */

Command.prototype.option = function(flags, description, fn, defaultValue) {
  var self = this,
    option = new Option(flags, description),
    oname = option.name(),
    name = option.attributeName();

  // default as 3rd arg
  if (typeof fn !== 'function') {
    if (fn instanceof RegExp) {
      var regex = fn;
      fn = function(val, def) {
        var m = regex.exec(val);
        return m ? m[0] : def;
      };
    } else {
      defaultValue = fn;
      fn = null;
    }
  }

  // preassign default value only for --no-*, [optional], or <required>
  if (!option.bool || option.optional || option.required) {
    // when --no-* we make sure default is true
    if (!option.bool) defaultValue = true;
    // preassign only if we have a default
    if (defaultValue !== undefined) {
      self[name] = defaultValue;
      option.defaultValue = defaultValue;
    }
  }

  // register the option
  this.options.push(option);

  // when it's passed assign the value
  // and conditionally invoke the callback
  this.on('option:' + oname, function(val) {
    // coercion
    if (val !== null && fn) {
      val = fn(val, self[name] === undefined ? defaultValue : self[name]);
    }

    // unassigned or bool
    if (typeof self[name] === 'boolean' || typeof self[name] === 'undefined') {
      // if no value, bool true, and we have a default, then use it!
      if (val == null) {
        self[name] = option.bool
          ? defaultValue || true
          : false;
      } else {
        self[name] = val;
      }
    } else if (val !== null) {
      // reassign
      self[name] = val;
    }
  });

  return this;
};

/**
 * Allow unknown options on the command line.
 *
 * @param {Boolean} arg if `true` or omitted, no error will be thrown
 * for unknown options.
 * @api public
 */
Command.prototype.allowUnknownOption = function(arg) {
  this._allowUnknownOption = arguments.length === 0 || arg;
  return this;
};

/**
 * Parse `argv`, settings options and invoking commands when defined.
 *
 * @param {Array} argv
 * @return {Command} for chaining
 * @api public
 */

Command.prototype.parse = function(argv) {
  // implicit help
  if (this.executables) this.addImplicitHelpCommand();

  // store raw args
  this.rawArgs = argv;

  // guess name
  this._name = this._name || basename(argv[1], '.js');

  // github-style sub-commands with no sub-command
  if (this.executables && argv.length < 3 && !this.defaultExecutable) {
    // this user needs help
    argv.push('--help');
  }

  // process argv
  var parsed = this.parseOptions(this.normalize(argv.slice(2)));
  var args = this.args = parsed.args;

  var result = this.parseArgs(this.args, parsed.unknown);

  // executable sub-commands
  var name = result.args[0];

  var aliasCommand = null;
  // check alias of sub commands
  if (name) {
    aliasCommand = this.commands.filter(function(command) {
      return command.alias() === name;
    })[0];
  }

  if (this._execs[name] && typeof this._execs[name] !== 'function') {
    return this.executeSubCommand(argv, args, parsed.unknown);
  } else if (aliasCommand) {
    // is alias of a subCommand
    args[0] = aliasCommand._name;
    return this.executeSubCommand(argv, args, parsed.unknown);
  } else if (this.defaultExecutable) {
    // use the default subcommand
    args.unshift(this.defaultExecutable);
    return this.executeSubCommand(argv, args, parsed.unknown);
  }

  return result;
};

/**
 * Execute a sub-command executable.
 *
 * @param {Array} argv
 * @param {Array} args
 * @param {Array} unknown
 * @api private
 */

Command.prototype.executeSubCommand = function(argv, args, unknown) {
  args = args.concat(unknown);

  if (!args.length) this.help();
  if (args[0] === 'help' && args.length === 1) this.help();

  // <cmd> --help
  if (args[0] === 'help') {
    args[0] = args[1];
    args[1] = '--help';
  }

  // executable
  var f = argv[1];
  // name of the subcommand, link `pm-install`
  var bin = basename(f, path__default.extname(f)) + '-' + args[0];

  // In case of globally installed, get the base dir where executable
  //  subcommand file should be located at
  var baseDir;

  var resolvedLink = fs.realpathSync(f);

  baseDir = dirname(resolvedLink);

  // prefer local `./<bin>` to bin in the $PATH
  var localBin = path__default.join(baseDir, bin);

  // whether bin file is a js script with explicit `.js` or `.ts` extension
  var isExplicitJS = false;
  if (exists(localBin + '.js')) {
    bin = localBin + '.js';
    isExplicitJS = true;
  } else if (exists(localBin + '.ts')) {
    bin = localBin + '.ts';
    isExplicitJS = true;
  } else if (exists(localBin)) {
    bin = localBin;
  }

  args = args.slice(1);

  var proc;
  if (process.platform !== 'win32') {
    if (isExplicitJS) {
      args.unshift(bin);
      // add executable arguments to spawn
      args = (process.execArgv || []).concat(args);

      proc = spawn(process.argv[0], args, { stdio: 'inherit', customFds: [0, 1, 2] });
    } else {
      proc = spawn(bin, args, { stdio: 'inherit', customFds: [0, 1, 2] });
    }
  } else {
    args.unshift(bin);
    proc = spawn(process.execPath, args, { stdio: 'inherit' });
  }

  var signals = ['SIGUSR1', 'SIGUSR2', 'SIGTERM', 'SIGINT', 'SIGHUP'];
  signals.forEach(function(signal) {
    process.on(signal, function() {
      if (proc.killed === false && proc.exitCode === null) {
        proc.kill(signal);
      }
    });
  });
  proc.on('close', process.exit.bind(process));
  proc.on('error', function(err) {
    if (err.code === 'ENOENT') {
      console.error('error: %s(1) does not exist, try --help', bin);
    } else if (err.code === 'EACCES') {
      console.error('error: %s(1) not executable. try chmod or run with root', bin);
    }
    process.exit(1);
  });

  // Store the reference to the child process
  this.runningCommand = proc;
};

/**
 * Normalize `args`, splitting joined short flags. For example
 * the arg "-abc" is equivalent to "-a -b -c".
 * This also normalizes equal sign and splits "--abc=def" into "--abc def".
 *
 * @param {Array} args
 * @return {Array}
 * @api private
 */

Command.prototype.normalize = function(args) {
  var ret = [],
    arg,
    lastOpt,
    index;

  for (var i = 0, len = args.length; i < len; ++i) {
    arg = args[i];
    if (i > 0) {
      lastOpt = this.optionFor(args[i - 1]);
    }

    if (arg === '--') {
      // Honor option terminator
      ret = ret.concat(args.slice(i));
      break;
    } else if (lastOpt && lastOpt.required) {
      ret.push(arg);
    } else if (arg.length > 1 && arg[0] === '-' && arg[1] !== '-') {
      arg.slice(1).split('').forEach(function(c) {
        ret.push('-' + c);
      });
    } else if (/^--/.test(arg) && ~(index = arg.indexOf('='))) {
      ret.push(arg.slice(0, index), arg.slice(index + 1));
    } else {
      ret.push(arg);
    }
  }

  return ret;
};

/**
 * Parse command `args`.
 *
 * When listener(s) are available those
 * callbacks are invoked, otherwise the "*"
 * event is emitted and those actions are invoked.
 *
 * @param {Array} args
 * @return {Command} for chaining
 * @api private
 */

Command.prototype.parseArgs = function(args, unknown) {
  var name;

  if (args.length) {
    name = args[0];
    if (this.listeners('command:' + name).length) {
      this.emit('command:' + args.shift(), args, unknown);
    } else {
      this.emit('command:*', args);
    }
  } else {
    outputHelpIfNecessary(this, unknown);

    // If there were no args and we have unknown options,
    // then they are extraneous and we need to error.
    if (unknown.length > 0) {
      this.unknownOption(unknown[0]);
    }
    if (this.commands.length === 0 &&
        this._args.filter(function(a) { return a.required; }).length === 0) {
      this.emit('command:*');
    }
  }

  return this;
};

/**
 * Return an option matching `arg` if any.
 *
 * @param {String} arg
 * @return {Option}
 * @api private
 */

Command.prototype.optionFor = function(arg) {
  for (var i = 0, len = this.options.length; i < len; ++i) {
    if (this.options[i].is(arg)) {
      return this.options[i];
    }
  }
};

/**
 * Parse options from `argv` returning `argv`
 * void of these options.
 *
 * @param {Array} argv
 * @return {Array}
 * @api public
 */

Command.prototype.parseOptions = function(argv) {
  var args = [],
    len = argv.length,
    literal,
    option,
    arg;

  var unknownOptions = [];

  // parse options
  for (var i = 0; i < len; ++i) {
    arg = argv[i];

    // literal args after --
    if (literal) {
      args.push(arg);
      continue;
    }

    if (arg === '--') {
      literal = true;
      continue;
    }

    // find matching Option
    option = this.optionFor(arg);

    // option is defined
    if (option) {
      // requires arg
      if (option.required) {
        arg = argv[++i];
        if (arg == null) return this.optionMissingArgument(option);
        this.emit('option:' + option.name(), arg);
      // optional arg
      } else if (option.optional) {
        arg = argv[i + 1];
        if (arg == null || (arg[0] === '-' && arg !== '-')) {
          arg = null;
        } else {
          ++i;
        }
        this.emit('option:' + option.name(), arg);
      // bool
      } else {
        this.emit('option:' + option.name());
      }
      continue;
    }

    // looks like an option
    if (arg.length > 1 && arg[0] === '-') {
      unknownOptions.push(arg);

      // If the next argument looks like it might be
      // an argument for this option, we pass it on.
      // If it isn't, then it'll simply be ignored
      if ((i + 1) < argv.length && argv[i + 1][0] !== '-') {
        unknownOptions.push(argv[++i]);
      }
      continue;
    }

    // arg
    args.push(arg);
  }

  return { args: args, unknown: unknownOptions };
};

/**
 * Return an object containing options as key-value pairs
 *
 * @return {Object}
 * @api public
 */
Command.prototype.opts = function() {
  var result = {},
    len = this.options.length;

  for (var i = 0; i < len; i++) {
    var key = this.options[i].attributeName();
    result[key] = key === this._versionOptionName ? this._version : this[key];
  }
  return result;
};

/**
 * Argument `name` is missing.
 *
 * @param {String} name
 * @api private
 */

Command.prototype.missingArgument = function(name) {
  console.error("error: missing required argument `%s'", name);
  process.exit(1);
};

/**
 * `Option` is missing an argument, but received `flag` or nothing.
 *
 * @param {String} option
 * @param {String} flag
 * @api private
 */

Command.prototype.optionMissingArgument = function(option, flag) {
  if (flag) {
    console.error("error: option `%s' argument missing, got `%s'", option.flags, flag);
  } else {
    console.error("error: option `%s' argument missing", option.flags);
  }
  process.exit(1);
};

/**
 * Unknown option `flag`.
 *
 * @param {String} flag
 * @api private
 */

Command.prototype.unknownOption = function(flag) {
  if (this._allowUnknownOption) return;
  console.error("error: unknown option `%s'", flag);
  process.exit(1);
};

/**
 * Variadic argument with `name` is not the last argument as required.
 *
 * @param {String} name
 * @api private
 */

Command.prototype.variadicArgNotLast = function(name) {
  console.error("error: variadic arguments must be last `%s'", name);
  process.exit(1);
};

/**
 * Set the program version to `str`.
 *
 * This method auto-registers the "-V, --version" flag
 * which will print the version number when passed.
 *
 * @param {String} str
 * @param {String} [flags]
 * @return {Command} for chaining
 * @api public
 */

Command.prototype.version = function(str, flags) {
  if (arguments.length === 0) return this._version;
  this._version = str;
  flags = flags || '-V, --version';
  var versionOption = new Option(flags, 'output the version number');
  this._versionOptionName = versionOption.long.substr(2) || 'version';
  this.options.push(versionOption);
  this.on('option:' + this._versionOptionName, function() {
    process.stdout.write(str + '\n');
    process.exit(0);
  });
  return this;
};

/**
 * Set the description to `str`.
 *
 * @param {String} str
 * @param {Object} argsDescription
 * @return {String|Command}
 * @api public
 */

Command.prototype.description = function(str, argsDescription) {
  if (arguments.length === 0) return this._description;
  this._description = str;
  this._argsDescription = argsDescription;
  return this;
};

/**
 * Set an alias for the command
 *
 * @param {String} alias
 * @return {String|Command}
 * @api public
 */

Command.prototype.alias = function(alias) {
  var command = this;
  if (this.commands.length !== 0) {
    command = this.commands[this.commands.length - 1];
  }

  if (arguments.length === 0) return command._alias;

  if (alias === command._name) throw new Error('Command alias can\'t be the same as its name');

  command._alias = alias;
  return this;
};

/**
 * Set / get the command usage `str`.
 *
 * @param {String} str
 * @return {String|Command}
 * @api public
 */

Command.prototype.usage = function(str) {
  var args = this._args.map(function(arg) {
    return humanReadableArgName(arg);
  });

  var usage = '[options]' +
    (this.commands.length ? ' [command]' : '') +
    (this._args.length ? ' ' + args.join(' ') : '');

  if (arguments.length === 0) return this._usage || usage;
  this._usage = str;

  return this;
};

/**
 * Get or set the name of the command
 *
 * @param {String} str
 * @return {String|Command}
 * @api public
 */

Command.prototype.name = function(str) {
  if (arguments.length === 0) return this._name;
  this._name = str;
  return this;
};

/**
 * Return prepared commands.
 *
 * @return {Array}
 * @api private
 */

Command.prototype.prepareCommands = function() {
  return this.commands.filter(function(cmd) {
    return !cmd._noHelp;
  }).map(function(cmd) {
    var args = cmd._args.map(function(arg) {
      return humanReadableArgName(arg);
    }).join(' ');

    return [
      cmd._name +
        (cmd._alias ? '|' + cmd._alias : '') +
        (cmd.options.length ? ' [options]' : '') +
        (args ? ' ' + args : ''),
      cmd._description
    ];
  });
};

/**
 * Return the largest command length.
 *
 * @return {Number}
 * @api private
 */

Command.prototype.largestCommandLength = function() {
  var commands = this.prepareCommands();
  return commands.reduce(function(max, command) {
    return Math.max(max, command[0].length);
  }, 0);
};

/**
 * Return the largest option length.
 *
 * @return {Number}
 * @api private
 */

Command.prototype.largestOptionLength = function() {
  var options = [].slice.call(this.options);
  options.push({
    flags: '-h, --help'
  });
  return options.reduce(function(max, option) {
    return Math.max(max, option.flags.length);
  }, 0);
};

/**
 * Return the largest arg length.
 *
 * @return {Number}
 * @api private
 */

Command.prototype.largestArgLength = function() {
  return this._args.reduce(function(max, arg) {
    return Math.max(max, arg.name.length);
  }, 0);
};

/**
 * Return the pad width.
 *
 * @return {Number}
 * @api private
 */

Command.prototype.padWidth = function() {
  var width = this.largestOptionLength();
  if (this._argsDescription && this._args.length) {
    if (this.largestArgLength() > width) {
      width = this.largestArgLength();
    }
  }

  if (this.commands && this.commands.length) {
    if (this.largestCommandLength() > width) {
      width = this.largestCommandLength();
    }
  }

  return width;
};

/**
 * Return help for options.
 *
 * @return {String}
 * @api private
 */

Command.prototype.optionHelp = function() {
  var width = this.padWidth();

  // Append the help information
  return this.options.map(function(option) {
    return pad(option.flags, width) + '  ' + option.description +
      ((option.bool && option.defaultValue !== undefined) ? ' (default: ' + JSON.stringify(option.defaultValue) + ')' : '');
  }).concat([pad('-h, --help', width) + '  ' + 'output usage information'])
    .join('\n');
};

/**
 * Return command help documentation.
 *
 * @return {String}
 * @api private
 */

Command.prototype.commandHelp = function() {
  if (!this.commands.length) return '';

  var commands = this.prepareCommands();
  var width = this.padWidth();

  return [
    'Commands:',
    commands.map(function(cmd) {
      var desc = cmd[1] ? '  ' + cmd[1] : '';
      return (desc ? pad(cmd[0], width) : cmd[0]) + desc;
    }).join('\n').replace(/^/gm, '  '),
    ''
  ].join('\n');
};

/**
 * Return program help documentation.
 *
 * @return {String}
 * @api private
 */

Command.prototype.helpInformation = function() {
  var desc = [];
  if (this._description) {
    desc = [
      this._description,
      ''
    ];

    var argsDescription = this._argsDescription;
    if (argsDescription && this._args.length) {
      var width = this.padWidth();
      desc.push('Arguments:');
      desc.push('');
      this._args.forEach(function(arg) {
        desc.push('  ' + pad(arg.name, width) + '  ' + argsDescription[arg.name]);
      });
      desc.push('');
    }
  }

  var cmdName = this._name;
  if (this._alias) {
    cmdName = cmdName + '|' + this._alias;
  }
  var usage = [
    'Usage: ' + cmdName + ' ' + this.usage(),
    ''
  ];

  var cmds = [];
  var commandHelp = this.commandHelp();
  if (commandHelp) cmds = [commandHelp];

  var options = [
    'Options:',
    '' + this.optionHelp().replace(/^/gm, '  '),
    ''
  ];

  return usage
    .concat(desc)
    .concat(options)
    .concat(cmds)
    .join('\n');
};

/**
 * Output help information for this command
 *
 * @api public
 */

Command.prototype.outputHelp = function(cb) {
  if (!cb) {
    cb = function(passthru) {
      return passthru;
    };
  }
  process.stdout.write(cb(this.helpInformation()));
  this.emit('--help');
};

/**
 * Output help information and exit.
 *
 * @api public
 */

Command.prototype.help = function(cb) {
  this.outputHelp(cb);
  process.exit();
};

/**
 * Camel-case the given `flag`
 *
 * @param {String} flag
 * @return {String}
 * @api private
 */

function camelcase(flag) {
  return flag.split('-').reduce(function(str, word) {
    return str + word[0].toUpperCase() + word.slice(1);
  });
}

/**
 * Pad `str` to `width`.
 *
 * @param {String} str
 * @param {Number} width
 * @return {String}
 * @api private
 */

function pad(str, width) {
  var len = Math.max(0, width - str.length);
  return str + Array(len + 1).join(' ');
}

/**
 * Output help information if necessary
 *
 * @param {Command} command to output help for
 * @param {Array} array of options to search for -h or --help
 * @api private
 */

function outputHelpIfNecessary(cmd, options) {
  options = options || [];
  for (var i = 0; i < options.length; i++) {
    if (options[i] === '--help' || options[i] === '-h') {
      cmd.outputHelp();
      process.exit(0);
    }
  }
}

/**
 * Takes an argument an returns its human readable equivalent for help usage.
 *
 * @param {Object} arg
 * @return {String}
 * @api private
 */

function humanReadableArgName(arg) {
  var nameOutput = arg.name + (arg.variadic === true ? '...' : '');

  return arg.required
    ? '<' + nameOutput + '>'
    : '[' + nameOutput + ']';
}

// for versions before node v0.8 when there weren't `fs.existsSync`
function exists(file) {
  try {
    if (fs.statSync(file).isFile()) {
      return true;
    }
  } catch (e) {
    return false;
  }
}
});
var D__code_apiServiceGenerator_node_modules_commander_1 = D__code_apiServiceGenerator_node_modules_commander.Command;
var D__code_apiServiceGenerator_node_modules_commander_2 = D__code_apiServiceGenerator_node_modules_commander.Option;

/**
 * 生成service
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
            const httpDependencies = modules.flatMap(module => {
                const includeModule = include(module, config.include);
                const excludedModule = exclude(includeModule, config.exclude);
                if (excludedModule.apis.length > 0) {
                    const targetPath = config.path + config.servicePath;
                    httpServiceGenerator.generate(Object.assign({}, excludedModule, { data: project.data, templatePath: config.serviceTemplatePath, targetPath }));
                    return httpServiceGenerator.getDependencies(excludedModule);
                }
                return [];
            });
            const entityGenerator = new EntityGenerator();
            const entities = yield parser.getApiEntity();
            const dependencies = getDependencies(entityGenerator, httpDependencies, entities);
            entities.filter((value) => dependencies.includes(value.name))
                .forEach((entity) => {
                const targetPath = config.path + config.entityPath;
                entityGenerator.generate(Object.assign({}, entity, { data: project.data, templatePath: config.entityTemplatePath, targetPath }));
            });
        }
    });
}
/**
 * 广度优先遍历，获取class的依赖
 * @param entityGenerator class生成器，用于解析entities依赖
 * @param dependencies  待获取的class
 * @param entities 描述class的对象
 * @return 依赖的class名数组
 */
function getDependencies(entityGenerator, dependencies, entities) {
    let newDependencies = dependencies; // 待搜索dependencies列表
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
function include(module, includeList) {
    if (!includeList || includeList.length === 0) {
        return Object.assign({}, module);
    }
    return Object.assign({}, module, { apis: module.apis.filter((api) => {
            return includeList.some(value => {
                return matching(value.path, api.path)
                    && (value.methods == null || value.methods.includes(api.method));
            });
        }) });
}
/**
 * 过滤掉不需要包含的api
 */
function exclude(module, excludeList) {
    if (!excludeList || excludeList.length === 0) {
        return Object.assign({}, module);
    }
    return Object.assign({}, module, { apis: module.apis.filter((api) => {
            return !excludeList.some(value => {
                return matching(value.path, api.path)
                    && (value.methods == null || value.methods.includes(api.method));
            });
        }) });
}
/**
 * 路径匹配
 */
function matching(reg, input) {
    return micromatch.isMatch(input, reg);
}
/**
 * 拷贝资源文件
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
(function () {
    return __awaiter(this, void 0, void 0, function* () {
        D__code_apiServiceGenerator_node_modules_commander
            .version(require('../package.json').version, '-v, --version') // tslint:disable-line
            .usage('[options]');
        D__code_apiServiceGenerator_node_modules_commander.option('-c, --config', '配置文件路径').parse(process.argv);
        console.log('生成中...');
        try {
            const config = loadConfig(D__code_apiServiceGenerator_node_modules_commander.config);
            yield copyAssets(config);
            yield generateService(config);
            console.log('生成完成');
        }
        catch (e) {
            console.error('生成失败');
            console.error(e);
        }
    });
})();

exports.generateService = generateService;
