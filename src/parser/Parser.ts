import { EntityGenerateData, HttpServiceGenerateData } from '../core';

export default interface Parser {
    getApis(): Promise<HttpServiceGenerateData[]>;

    getApiEntity(): Promise<EntityGenerateData[]>;
}
