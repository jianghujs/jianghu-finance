'use strict';

// ========================================常用 require start===========================================
const Service = require('egg').Service;
const _ = require('lodash');
// ========================================常用 require end=============================================


class ConstantService extends Service {

  async getConstantObj() {
    const { jianghuKnex } = this.app;
    const constantList = await jianghuKnex('_constant', this.ctx).select();
    constantList.forEach(constant => {
      try {
        constant.constantValue = JSON.parse(constant.constantValue);
      } catch (e) {
        console.error('parse constantValue error', constant.constantKey)
      }
    });
    const constantObj = _.mapValues(_.keyBy(constantList, 'constantKey'), 'constantValue');

    return constantObj;
  }
}

module.exports = ConstantService;
