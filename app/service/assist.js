const Service = require('egg').Service;
const idGenerateUtil = require("@jianghujs/jianghu/app/common/idGenerateUtil");
const validateUtil = require('@jianghujs/jianghu/app/common/validateUtil');
const { subjectCategoryEnum, tableEnum } = require('../constant/constant');
const { BizError, errorInfoEnum } = require('../constant/error');

const actionDataScheme = Object.freeze({
  getAssistList: {
    type: 'object',
    additionalProperties: true,
    required: [ 'assistType' ],
    properties: {
      assistType: { anyOf: [{ type: "string" }, { type: "number" }] },
    },
  },
});

class VoucherService extends Service {
  // 获取所有表名称
  async _getTableNames() {
    const { knex } = this.app
    return knex.raw('SHOW TABLES')
    .then((tables) => {
      let tableNames = [];
      for (let table of tables[0]) {
        for (let key in table) {
          tableNames.push(table[key]);
        }
      }
      return tableNames;
    });
  }

  async _getAssistList() {
    const { jianghuKnex } = this.app;
    const assistList = await jianghuKnex(tableEnum._constant, this.ctx).where({ constantKey: 'assistList' }).select().first();
    const assistListValue = JSON.parse(assistList.constantValue);
    return assistListValue;
  }

  async selectAssistList(actionData) {
    const { jianghuKnex, knex } = this.app;
    const { subjectId } = actionData || {};
    let subjectAssistList = [];
    if (subjectId) {
      const subject = await jianghuKnex(tableEnum.subject, this.ctx).where({ subjectId }).select().first();
      if (subject && subject.assistList) {
        subjectAssistList = subject.assistList.split(",");
      }
    }

    const assistListValue = await this._getAssistList();
    const assistTables = assistListValue.map((assist) => `assist_${assist.value}`);

    const result = await Promise.all(
      assistTables.map(
        (tableName)=> jianghuKnex(tableName, this.ctx).orderBy('assistId', 'asc').select('assistId', 'assistName'),
      ),
    )
    // 将assistTables和assistDatat绑定，一一对应，assistTables[i]对应assistData[i]
    const assistData = {}
    assistListValue.forEach((assist, index) => {
      assistData[assist.text] = result[index];
    })

    return assistData;
  }


  async getAssistList(actionData) {
    const { jianghuKnex } = this.app;
    const { appaId, where } = this.ctx.request.body.appData;

    validateUtil.validate(actionDataScheme.getAssistList, where);
    const { assistType } = where || {};

    // 表名是assist_ + assistType
    let assistList = []
    const tableName = `assist_${assistType}`;
    // assist_cash_flow是视图，不需要删除和新增
    if (assistType === 'cash_flow') {
      assistList = await jianghuKnex(tableName, this.ctx).select();
    } else {
      assistList = await jianghuKnex(tableName, this.ctx).where({ appaId }).select();
    }

    return { rows: assistList}
  }

  async insertAssistItem(actionData) {
    const { jianghuKnex } = this.app;
    const { appaId } = this.ctx.request.body.appData;
    const { assistType, ...insertData } = actionData || {};

    // 表名是assist_ + assistType
    const tableName = `assist_${assistType}`;
    await jianghuKnex(tableName, this.ctx).jhInsert({ appaId, ...insertData });
  }

  async updateAssistItem(actionData) {
    const { jianghuKnex } = this.app;
    const { where = {} } = this.ctx.request.body.appData;

    validateUtil.validate(actionDataScheme.getAssistList, where);
    const { assistType, ...updateData } = actionData || {};

    // 表名是assist_ + assistType
    const tableName = `assist_${assistType}`;
    await jianghuKnex(tableName, this.ctx).where( {id: where.id}).jhUpdate(updateData);
  }
}

module.exports = VoucherService;