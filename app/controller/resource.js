'use strict';

const { Controller } = require('egg');
const { BizError, errorInfoEnum } = require('@jianghujs/jianghu/app/constant/error');
const { resourceTypeObj, httpResponse } = require('@jianghujs/jianghu/app/constant/constant');
const _ = require('lodash');
const { sqlResource, serviceResource } = require('./controllerUtil/resourceUtil');

class ResourceController extends Controller {

  async httpRequest() {
    const { ctx, app } = this;
    const { config: { appId }, jianghuKnex } = app;
    const { body } = ctx.request;
    const { packageId, appData = {} } = body;
    const { packageResource } = ctx;
    const { pageId, actionId, resourceType, resourceId } = packageResource;

    let resultData;
    switch (resourceType) {
      case resourceTypeObj.sql:
        resultData = await sqlResource({ jianghuKnex, ctx });
        ctx.body = httpResponse.success({
          packageId,
          appData: { resultData, appId, pageId, actionId },
        });
        break;
      case resourceTypeObj.service:
        resultData = await serviceResource({ ctx });
        ctx.body = httpResponse.success({
          packageId,
          appData: { resultData, appId, pageId, actionId },
        });
        break;
      default:
        throw new BizError(errorInfoEnum.resource_not_support);
    }
  }

}

module.exports = ResourceController;

