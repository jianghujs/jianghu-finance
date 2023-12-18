const Service = require('egg').Service;
const idGenerateUtil = require("@jianghujs/jianghu/app/common/idGenerateUtil");
const validateUtil = require('@jianghujs/jianghu/app/common/validateUtil');
const { subjectCategoryEnum, tableEnum } = require('../constant/constant');
const { BizError, errorInfoEnum } = require('../constant/error');


const actionDataScheme = Object.freeze({
  importEmployeeData: {
    type: 'object',
    additionalProperties: true,
    required: ['staffList'],
    properties: {
      staffList: {
        type: 'array',
        items: {}
      },
    },
  },
});

class StaffService extends Service {
  async importEmployeeData(actionData) {
    const { jianghuKnex, knex } = this.app;
    validateUtil.validate(actionDataScheme.importEmployeeData, actionData);
    const { staffList } = actionData;

    let idSequence = await idGenerateUtil.idPlus({
      knex,
      tableName: 'employee',
      columnName: 'idSequence',
    })
    // 向employee插入数据
    const employeeList = staffList.map((staff) => {
      idSequence++;
      return {
        idSequence,
        ...staff,
        employeeId: `YG${idSequence}`,
      };
    });

    await jianghuKnex(tableEnum.employee, this.ctx).jhInsert(employeeList);
  }
}

module.exports = StaffService;