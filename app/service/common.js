const Service = require('egg').Service;
const validateUtil = require('@jianghujs/jianghu/app/common/validateUtil');
const { BizError, errorInfoEnum } = require('../constant/error');
const _ = require('lodash');


const actionDataScheme = Object.freeze({
  generateBizIdOfBeforeHook: {
    type: 'object',
    additionalProperties: true,
    required: [ 'type', 'bizId', 'tableName' ],
    properties: {
      type: { type: 'string', enum: [ 'idSequence' ] },
      bizId: { anyOf: [{ type: "string" }, { type: "number" }] },
      tableName: { anyOf: [{ type: "string" }, { type: "number" }] },
      prefix: { anyOf: [{ type: "string" }, { type: "number" }, { type: "null" }] },
    },
  },
});
class CommonService extends Service {

  async generateBizIdOfBeforeHook() {
    const { jianghuKnex } = this.app;
    const bizIdGenerate = this.ctx.request.body.appData.bizIdGenerate;
    validateUtil.validate(actionDataScheme.generateBizIdOfBeforeHook, bizIdGenerate, "BizId生成");
    const { type, bizId, tableName } = bizIdGenerate;
    const prefix = bizIdGenerate.prefix || '';
    const startValue = bizIdGenerate.startValue || 1001;

    if (type === 'idSequence') {
      let newIdSequence = null;
      const newIdSequenceResult = await jianghuKnex(tableName, this.ctx)
        .max('idSequence', { as: "newIdSequence" })
        .first();
      if (!newIdSequenceResult.newIdSequence) {
        newIdSequence = startValue
      } if (newIdSequenceResult.newIdSequence < startValue) {
        newIdSequence = startValue
      } else {
        newIdSequence = parseInt(newIdSequenceResult.newIdSequence) + 1;
      }
      const newBizId = prefix+ newIdSequence;
      this.ctx.request.body.appData.actionData.idSequence = newIdSequence;
      this.ctx.request.body.appData.actionData[bizId] = newBizId;
    } else {
      throw new BizError(errorInfoEnum.data_exception); 
    }
  }

}

module.exports = CommonService;