module.exports = `
import {Injectable} from '@angular/core';
import {ApiService} from '@core/net/api.service';
import HttpResult from '@api/entity/HttpResult';
import {map} from 'rxjs/operators';
{{#dependencies}}
import {{{.}}} from '../entity/{{{.}}}';
{{/dependencies}}


// {{{description}}}
@Injectable({providedIn: 'root'})
export class {{name}}Service {
  private http: ApiService;
  constructor(http: ApiService) {
    this.http = http{{#data}}.setTempUrl('{{{baseUrl}}}'){{/data}};
  }

  {{#apis}}
  /**
   * {{{description}}}{{#params}}
   * @param {{{name}}} {{{description}}}{{/params}}
   */
  {{{name}}}({{#params}}{{{name}}}?: {{{typeString}}}, {{/params}}options?: any): Promise<{{{returnType}}}> {
    return this.http.{{method}}<HttpResult<{{{returnType}}}>>({{{pathString}}}, {{{bodyString}}}{{^bodyString}}null{{/bodyString}}, {...options{{#queryString}}, params: {{/queryString}}{{{queryString}}}})
           .pipe(map(value => value.result)).toPromise();
  }

  {{/apis}}
}

`;
