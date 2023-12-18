const Service = require('egg').Service;
const validateUtil = require('@jianghujs/jianghu/app/common/validateUtil');
const { BizError, errorInfoEnum } = require('../constant/error');
const _ = require('lodash');
const dayjs = require('dayjs');
const { tableEnum } = require('../constant/constant');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

const actionDataScheme = Object.freeze({
  createAppAcount: {
    type: 'object',
    additionalProperties: true,
    required: ['appaId', 'appaName'],
    properties: {
      appaId: { anyOf: [{ type: "string" }, { type: "number" }] },
      appaName: { anyOf: [{ type: "string" }, { type: "number" }] },
    },
  },
  initAppAcountConfigTable: {
    type: 'object',
    additionalProperties: true,
    required: ['appaId'],
    properties: {
      appaId: { anyOf: [{ type: "string" }, { type: "number" }] },
    },
  },

  importAppAccountDataOfSubjectList: {
    type: 'object',
    additionalProperties: true,
    required: ['appaId', 'subjectList'],
    properties: {
      appaId: { anyOf: [{ type: "string" }, { type: "number" }] },
      subjectList: {
        type: 'array',
        items: {
          type: 'object',
          required: ['subjectId', 'subjectName', 'subjectBalanceDirection'],
          properties: {
            subjectId: { anyOf: [{ type: "string" }, { type: "number" }] },
            subjectName: { anyOf: [{ type: "string" }, { type: "number" }] },
            subjectBalanceDirection: { type: "string", enum: ['借', '贷'] },
          }
        }
      },
    },
  },


  importAppAccountDataOfVoucherList: {
    type: 'object',
    additionalProperties: true,
    required: ['appaId', 'voucherEntryList'],
    properties: {
      appaId: { anyOf: [{ type: "string" }, { type: "number" }] },
      subjectList: {
        type: 'array',
        items: {
          type: 'object',
          required: ['voucherId'],
          properties: {
            voucherId: { anyOf: [{ type: "string" }, { type: "number" }] },
          }
        }
      },
    },
  },

  reCheckoutAllPeriod: {
    type: 'object',
    additionalProperties: true,
    required: ['appaId'],
    properties: {
      appaId: { anyOf: [{ type: "string" }, { type: "number" }] },
    },
  },

  updateAppAcount: {
    type: 'object',
    additionalProperties: true,
    required: ['appaId', 'periodIdStart'],
    properties: {
      appaId: { anyOf: [{ type: "string" }, { type: "number" }] },
      periodIdStart: { anyOf: [{ type: "string" }, { type: "number" }] },
    },
  },

  deleteAppAccount: {
    type: 'object',
    additionalProperties: true,
    required: ['appaId'],
    properties: {
      appaId: { anyOf: [{ type: "string" }, { type: "number" }] },
    },
  },

  addCustomAssist: {
    type: 'object',
    additionalProperties: true,
    required: ['tableName', 'typeName'],
    properties: {
      tableName: { anyOf: [{ type: "string" }, { type: "number" }] },
      typeName: { anyOf: [{ type: "string" }, { type: "number" }] },
    },
  },

});

const deleteIdAndSetNewAppaId = ({ list, newAppaId }) => {
  list.forEach(item => {
    delete item.id;
    delete item.operation;
    delete item.operationByUserId;
    delete item.operationByUser;
    delete item.operationAt;
    item.appaId = newAppaId;
  });
}

const computeSubjectLabel = ({ subjectId, subjectName, subjectList }) => {
  // 获取父级IDList
  let parentSubjectIdLinkList = [];
  let parentSubjectIdLength = 4;
  while (parentSubjectIdLength < subjectId.length) {
    parentSubjectIdLinkList.push(subjectId.slice(0, parentSubjectIdLength));
    parentSubjectIdLength += 2;
  }
  // 获取名称
  const parentSubjectIdLinkNameList = parentSubjectIdLinkList.map(parentSubjectIdLink => {
    const parentSubject = subjectList.find(subject => subject.subjectId == parentSubjectIdLink);
    return parentSubject.subjectName;
  })
  // 添加当前科目名称
  parentSubjectIdLinkNameList.push(subjectName);
  return parentSubjectIdLinkNameList.join('_');
}

function getIsAdminFromUserInfo({ userInfo }) {
  const { userGroupRoleList } = userInfo;
  const hasAdminGroup = userGroupRoleList.findIndex(group => group.groupId === 'adminGroup') > -1;
  return hasAdminGroup;
}

function getIsManagerOrAdmin({ userInfo, appaManagerId }) {
  const { userGroupRoleList, userId } = userInfo;
  const isAdmin = userGroupRoleList.findIndex(group => group.groupId === 'adminGroup') > -1;
  const isManager = (userId == appaManagerId);
  return isManager || isAdmin;
}

class AppAccountService extends Service {

  async selectAppAccountList() {
    const { jianghuKnex } = this.app;
    const { userId } = this.ctx.userInfo;
    const { where } = this.ctx.request.body.appData;

    const isAdmin = getIsAdminFromUserInfo({ userInfo: this.ctx.userInfo });
    let rows = [];
    if (isAdmin) {
      rows = await jianghuKnex(tableEnum._app_account, this.ctx)
        .where(Object.assign({}, { appaType: '普通账套' }, where))
        .orderBy('appaStatus', 'desc').orderBy('appaName', 'desc')
        .select();
    }
    if (!isAdmin) {
      rows = await jianghuKnex(tableEnum._app_account, this.ctx)
        .where({ appaType: '普通账套', appaStatus: '账套启用' }).where('appaMemberIdList', 'like', `%${userId}%`)
        .orderBy('appaStatus', 'desc').orderBy('appaName', 'desc')
        .select();
    }

    rows.forEach(row => {
      const isManagerOrAdmin = getIsManagerOrAdmin({ userInfo: this.ctx.userInfo, appaManagerId: row.appaManagerId });
      row.isManagerOrAdmin = isManagerOrAdmin;
    })

    return {
      isAdmin,
      rows,
    };
  }

  async createAppAcount() {
    const { knex, config } = this.app;
    const actionData = this.ctx.request.body.appData.actionData;
    validateUtil.validate(actionDataScheme.createAppAcount, actionData);
    const { appaId, appaStandard } = actionData;
    // Tip: 避免误操作其它帐套的数据
    this.ctx.request.body.appData.appaId = appaId;

    await knex(tableEnum._app_account).insert(actionData);
    await this.initAppAcountConfigTable({ appaId });
  }

  /**
   * initAppaIdData 需要跨账套操作数据==》所以此处用的是knex
   */
  async initAppAcountConfigTable(actionData) {
    const { knex } = this.app;
    validateUtil.validate(actionDataScheme.initAppAcountConfigTable, actionData);
    const { appaId } = actionData;
    const appAccount = await knex(tableEnum._app_account).where({ appaId }).first();
    const { periodIdStart, periodIdEnd, appaStandard } = appAccount;

    if (this.app.config.appaIdDisableEditList.includes(appaId)) {
      throw new BizError(errorInfoEnum.disable_edit_appaId)
    }
    // Tip: 避免误操作其它帐套的数据
    this.ctx.request.body.appData.appaId = appaId;

    const configTableList = [
      { mbTable: 'mb_subject', accountTable: 'subject' },
      { mbTable: 'mb_voucher_template', accountTable: 'voucher_template' },
      { mbTable: 'mb_report_asset_liability_formula', accountTable: 'report_asset_liability_formula' },
      { mbTable: 'mb_report_asset_liability_item', accountTable: 'report_asset_liability_item' },
      { mbTable: 'mb_report_cash_flow_ex_formula', accountTable: 'report_cash_flow_ex_formula' },
      { mbTable: 'mb_report_cash_flow_ex_item', accountTable: 'report_cash_flow_ex_item' },
      { mbTable: 'mb_report_cash_flow_item', accountTable: 'report_cash_flow_item' },
      { mbTable: 'mb_report_cash_flow_item3', accountTable: 'report_cash_flow_item3' },
      { mbTable: 'mb_report_profit_formula', accountTable: 'report_profit_formula' },
      { mbTable: 'mb_report_profit_item', accountTable: 'report_profit_item' },
      { mbTable: 'mb_report_summary_item', accountTable: 'report_summary_item' },
      { mbTable: 'mb_currency', accountTable: 'currency' },
    ];
    const clearTableList = ['period', 'subject_balance_period', 'subject_balance_year', 'subject_balance_year_adjust'];
    await knex.transaction(async trx => {
      for (const tableObj of configTableList) {
        let listOfTemplate = await trx(tableObj.mbTable).where({ appaId: appaStandard }).select();
        deleteIdAndSetNewAppaId({ list: listOfTemplate, newAppaId: appaId });
        await trx(tableObj.accountTable).where({ appaId }).delete();

        await trx(tableObj.accountTable).insert(listOfTemplate);
      }

      for (const table of clearTableList) {
        await trx(table).where({ appaId }).delete();
      }
    });

    if (periodIdStart) {
      await this.ctx.service.period.createPeriodStart({ periodId: periodIdStart });
    }
    await this.ctx.service.subject.getAmendSubjectList();

    // if (periodIdStart && periodIdEnd) {
    //   const periodIdStartDayjs = dayjs(periodIdStart);
    //   const periodIdEndDayjs = dayjs(periodIdEnd);
    //   const diffMonth = periodIdEndDayjs.diff(periodIdStartDayjs, 'month');
    //   for (let i = 0; i < diffMonth; i++) {
    //     const periodIdCurrentDayjs =  periodIdStartDayjs.add(i, 'month');
    //     const periodIdNextDayjs =  periodIdStartDayjs.add(i+1, 'month');
    //     const periodIdCurrent = periodIdCurrentDayjs.format('YYYY-MM');
    //     const periodIdNext = periodIdNextDayjs.format('YYYY-MM');
    //     await this.ctx.service.period.checkout({ currentPeriodId: periodIdCurrent, nextPeriodId: periodIdNext, checkBalanceNeed: false });
    //   }
    // }
  }

  async importAppAccountDataOfSubjectList(actionData) {
    const { knex } = this.app;
    validateUtil.validate(actionDataScheme.importAppAccountDataOfSubjectList, actionData);
    // 使用解构赋值简化代码
    const { appaId, subjectList } = actionData;

    // 使用解构赋值简化错误处理
    if (this.app.config.appaIdDisableEditList.includes(appaId)) {
      throw new BizError(errorInfoEnum.disable_edit_appaId);
    }

    // 避免误操作其他账套数据的简化
    this.ctx.request.body.appData.appaId = appaId;

    // 使用解构赋值简化代码
    const { periodIdStart } = await knex(tableEnum._app_account).where({ appaId }).first();

    // 使用filter和map简化代码
    const _subjectInsertList = subjectList
      .filter(subject => subject.isNewSubject)
      .map(({ rowNumber, isNewSubject, startAmount, ...subject }) => subject);

    const subjectInsertList = await this.ctx.service.subject._amendSubjectCashflow(_subjectInsertList)
    const subjectBalancePeriodStartList = subjectList.map(subject => {
      const { startAmount, subjectBalanceDirection, ...subjectInsert } = subject;

      return {
        subjectId: subject.subjectId,
        periodId: periodIdStart,
        isPeriodStart: '是',
        financeYear: dayjs(periodIdStart).year(),
        startDebit: subjectBalanceDirection === '借' ? (startAmount || 0) : 0,
        startCredit: subjectBalanceDirection === '借' ? 0 : (startAmount || 0),
      };
    });

    // 使用数组字面量简化代码
    const clearTableList = ['subject_balance_period', 'subject_balance_year', 'subject_balance_year_adjust'];

    // 使用事务简化代码
    await knex.transaction(async trx => {
      // 使用Promise.all简化代码
      await Promise.all([
        deleteIdAndSetNewAppaId({ list: subjectInsertList, newAppaId: appaId }),
        deleteIdAndSetNewAppaId({ list: subjectBalancePeriodStartList, newAppaId: appaId }),
        trx(tableEnum.subject).insert(subjectInsertList),
        ...clearTableList.map(table => trx(table).where({ appaId }).delete()),
        trx(tableEnum.subject_balance_period).insert(subjectBalancePeriodStartList),
      ]);
    });
  }

  // TODO: 待清理, 代码冗余
  async importAppAccountDataOfVoucherList() {
    const { knex } = this.app;
    const actionData = this.ctx.request.body.appData.actionData;
    validateUtil.validate(actionDataScheme.importAppAccountDataOfVoucherList, actionData);
    const { appaId, voucherEntryList } = actionData;

    if (this.app.config.appaIdDisableEditList.includes(appaId)) {
      throw new BizError(errorInfoEnum.disable_edit_appaId)
    }
    // Tip: 避免误操作其它帐套的数据
    this.ctx.request.body.appData.appaId = appaId;

    voucherEntryList.forEach(ve => {
      const { year, month, day, voucherName, voucherNumber } = ve;
      const voucherAt = dayjs().year(year).month(month - 1).date(day).format("YYYY-MM-DD");
      const periodId = dayjs().year(year).month(month - 1).format("YYYY-MM");
      const voucherId = `${periodId}-${voucherName}-${voucherNumber}`;
      ve.voucherAt = voucherAt;
      ve.periodId = periodId;
      ve.voucherId = voucherId;
    });

    // TODO: 自动生成 assistId
    const voucherEntryListNew = voucherEntryList.map(ve => {
      const {
        voucherId, subjectId, entryAbstract, debit, credit,
        assistNameOfCustomer, assistNameOfSupplier, assistNameOfStaff, assistNameOfProject, assistNameOfDepart,
      } = ve;
      const assistIdOfCustomer = assistNameOfCustomer ? `KH${assistNameOfCustomer}` : null;
      const assistIdOfSupplier = assistNameOfSupplier ? `GH${assistNameOfSupplier}` : null;
      const assistIdOfStaff = assistNameOfStaff ? `YG${assistNameOfStaff}` : null;
      const assistIdOfProject = assistNameOfProject ? `XM${assistNameOfProject}` : null;
      const assistIdOfDepart = assistNameOfProject ? `BM${assistNameOfDepart}` : null;
      return {
        voucherId, subjectId, entryAbstract, debit: debit || 0, credit: credit || 0,
        assistNameOfCustomer, assistNameOfSupplier, assistNameOfStaff, assistNameOfProject, assistNameOfDepart,
        assistIdOfCustomer, assistIdOfSupplier, assistIdOfStaff, assistIdOfProject, assistIdOfDepart,
      };
    });

    const assistCustomerList = _.uniqBy(voucherEntryListNew, 'assistIdOfCustomer')
      .map(item => { return { assistId: item.assistIdOfCustomer, assistName: item.assistNameOfCustomer } })
      .filter(item => item.assistName);
    const assistSupplierList = _.uniqBy(voucherEntryListNew, 'assistIdOfSupplier')
      .map(item => { return { assistId: item.assistIdOfSupplier, assistName: item.assistNameOfSupplier } })
      .filter(item => item.assistName);
    const assistStaffList = _.uniqBy(voucherEntryListNew, 'assistIdOfStaff')
      .map(item => { return { assistId: item.assistIdOfStaff, assistName: item.assistNameOfStaff } })
      .filter(item => item.assistName);
    const assistProjectList = _.uniqBy(voucherEntryListNew, 'assistIdOfProject')
      .map(item => { return { assistId: item.assistIdOfProject, assistName: item.assistNameOfProject } })
      .filter(item => item.assistName);
    const assistDepartList = _.uniqBy(voucherEntryListNew, 'assistIdOfDepart')
      .map(item => { return { assistId: item.assistIdOfDepart, assistName: item.assistNameOfDepart } })
      .filter(item => item.assistName);
    const voucherList = [];
    const voucherIdMap = _.groupBy(voucherEntryList, 'voucherId');
    for (const voucherId in voucherIdMap) {
      const entryList = voucherIdMap[voucherId];
      const entry1 = entryList[0];
      const { voucherName, voucherNumber, voucherAt, periodId } = entry1;
      voucherList.push({ voucherId, voucherAt, periodId, voucherName, voucherNumber });
    }

    await knex.transaction(async trx => {
      deleteIdAndSetNewAppaId({ list: voucherEntryListNew, newAppaId: appaId });
      deleteIdAndSetNewAppaId({ list: voucherList, newAppaId: appaId });
      deleteIdAndSetNewAppaId({ list: assistCustomerList, newAppaId: appaId });
      deleteIdAndSetNewAppaId({ list: assistSupplierList, newAppaId: appaId });
      deleteIdAndSetNewAppaId({ list: assistStaffList, newAppaId: appaId });
      deleteIdAndSetNewAppaId({ list: assistProjectList, newAppaId: appaId });
      deleteIdAndSetNewAppaId({ list: assistDepartList, newAppaId: appaId });


      await trx(tableEnum.voucher).where({ appaId }).delete();
      await trx(tableEnum.voucher_entry).where({ appaId }).delete();
      await trx(tableEnum.voucher).insert(voucherList);
      await trx(tableEnum.voucher_entry).insert(voucherEntryListNew);

      await trx(tableEnum.assist_customer).where({ appaId }).delete();
      await trx(tableEnum.assist_supplier).where({ appaId }).delete();
      await trx(tableEnum.assist_staff).where({ appaId }).delete();
      await trx(tableEnum.assist_project).where({ appaId }).delete();
      await trx(tableEnum.assist_depart).where({ appaId }).delete();

      if (assistCustomerList.length > 0) { await trx(tableEnum.assist_customer).insert(assistCustomerList); }
      if (assistSupplierList.length > 0) { await trx(tableEnum.assist_supplier).insert(assistSupplierList); }
      if (assistStaffList.length > 0) { await trx(tableEnum.assist_staff).insert(assistStaffList); }
      if (assistProjectList.length > 0) { await trx(tableEnum.assist_project).insert(assistProjectList); }
      if (assistDepartList.length > 0) { await trx(tableEnum.assist_depart).insert(assistDepartList); }
    });
  }


  async reCheckoutAllPeriod() {
    // 异步处理 不要await
    this.reCheckoutAllPeriodAsync();
  }

  async reCheckoutAllPeriodAsync() {
    const { knex } = this.app;
    const actionData = this.ctx.request.body.appData.actionData;
    validateUtil.validate(actionDataScheme.reCheckoutAllPeriod, actionData);
    const { appaId } = actionData;

    const appAccount = await knex(tableEnum._app_account).where({ appaId }).first();
    const { periodIdStart } = appAccount;
    const periodList = await knex(tableEnum.period).where({ appaId }).select();

    // periodIdEnd取凭证表中最大的凭证日期
    const voucherList = await knex(tableEnum.voucher).where({ appaId }).select();

    let periodIdEnd = null;
    if (voucherList.length > 0) {
      const voucherListSorted = _.sortBy(voucherList, 'voucherAt');
      const voucherLast = voucherListSorted[voucherListSorted.length - 1];
      periodIdEnd = voucherLast ? dayjs(voucherLast.voucherAt).format('YYYY-MM') : null;
    }

    // Tip: 避免误操作其它帐套的数据
    this.ctx.request.body.appData.appaId = appaId;

    await knex(tableEnum._app_account).where({ appaId }).update({ subjectBalanceCalcStatus: '计算中' });

    if (periodIdStart && periodIdEnd) {
      const periodIdStartDayjs = dayjs(periodIdStart);
      const periodIdEndDayjs = dayjs(periodIdEnd);
      const diffMonth = periodIdEndDayjs.diff(periodIdStartDayjs, 'month');
      for (let i = 0; i <= diffMonth; i++) {
        const periodIdCurrentDayjs = periodIdStartDayjs.add(i, 'month');
        const periodIdCurrent = periodIdCurrentDayjs.format('YYYY-MM');
        const periodTarget = periodList.find(p => p.periodId == periodIdCurrent);
        const isPeriodStart = periodIdStart == periodIdCurrent ? '是' : '否';
        if (!periodTarget) {
          await knex(tableEnum.period).insert({
            appaId,
            periodId: periodIdCurrent,
            financeYear: dayjs(periodIdCurrent).year(),
            isCheckout: '已结账', isPeriodStart,
          });
        }
      }
    }

    if (this.app.config.appaIdDisableEditList.includes(appaId)) {
      throw new BizError(errorInfoEnum.disable_edit_appaId)
    }

    await this.ctx.service.period.reCheckoutAllPeriod({ checkBalanceNeed: false });

    await knex(tableEnum._app_account).where({ appaId }).update({ subjectBalanceCalcStatus: '完成' });
  }

  // 检查账套是否有凭证数据
  async checkAppAccountExistVoucher(actionData) {
    const { appaId } = actionData
    const { jianghuKnex, knex } = this.app;
    const result = await knex(tableEnum.voucher).where({ appaId }).whereNot({ voucherType: '累计' }).first();
    return result ? true : false;
  }

  // 更新账套
  // 账套启用年月处理
  async updateAppAcount(actionData) {
    const { jianghuKnex, knex } = this.app;
    validateUtil.validate(actionDataScheme.updateAppAcount, actionData);
    const { appaId, periodIdStart } = actionData

    // 检查是否修改了账套启用年月
    const appAcount = await knex(tableEnum._app_account).where({ appaId }).first()


    await knex.transaction(async (trx, trxKnex) => {
      await trx(tableEnum._app_account).where({ appaId }).update(actionData);
      await trx(tableEnum.period)
        .where({ isPeriodStart: '是', appaId })
        .update({ periodId: periodIdStart, financeYear: dayjs(periodIdStart).year() });

      if (appAcount.periodIdStart != periodIdStart) {
        // 科目初始余额更新
        await Promise.all([
          trx(tableEnum.subject_balance_period)
            .where({ appaId, isPeriodStart: '是' })
            .update({
              periodId: periodIdStart,
              financeYear: dayjs(periodIdStart).year()
            }),
          trx(tableEnum.subject_balance_year)
            .where({ appaId })
            .update({
              financeYear: dayjs(periodIdStart).year()
            })
        ]).then(trx.commit).catch(trx.rollback);
      }

    })
  }
  // 添加自定义的辅助核算
  async addCustomAssist(actionData) {
    validateUtil.validate(actionDataScheme.addCustomAssist, actionData);
    // 从actionData中获取数据，要创建的表名tableName，表名的备注typeName
    const { jianghuKnex, knex } = this.app;
    const { tableName, typeName, columns = [] } = actionData || {};
    const { appaId } = this.ctx.request.body.appData;

    // 判断当前用户是否是管理员
    const isAdmin = getIsAdminFromUserInfo({ userInfo: this.ctx.userInfo });
    if (!isAdmin) {
      throw new BizError(errorInfoEnum.not_admin);
    }

    // 判断表是否存在，不存在则创建
    const isTableExist = await knex.schema.hasTable(`assist_${tableName}`);
    if (isTableExist) {
      return;
    }

    // 在voucher_entry表里加上辅助核算的字段
    await knex.schema.alterTable(tableEnum.voucher_entry, table => {
      // tableName首字母要大写
      const tableNameFirstLetter = tableName.slice(0, 1).toUpperCase();
      const tableNameOtherLetter = tableName.slice(1);
      const tableNameUpper = `${tableNameFirstLetter}${tableNameOtherLetter}`;

      table.string(`assistNameOf${tableNameUpper}`, 255).collate('utf8mb4_bin').nullable().comment(`辅助核算-${typeName}ID;`);
      table.string(`assistIdOf${tableNameUpper}`, 255).collate('utf8mb4_bin').nullable().comment(`辅助核算-${typeName}名称;`);
    })

    await knex.schema.createTable(`assist_${tableName}`, table => {
      table.increments('id').primary();
      table.string('appaId', 255).collate('utf8mb4_bin').nullable().comment('账套ID');
      table.string('assistId', 255).collate('utf8mb4_bin').nullable().comment('ID;');
      table.string('assistName', 255).collate('utf8mb4_bin').nullable().comment('名称');
      // columns是个数组，每个元素是个对象，对象的key是字段名
      columns.forEach((column) => {
        const { colKey, colValue } = column || {};
        table.string(colKey, 255).collate('utf8mb4_bin');
      })
      table.string('operation', 255).collate('utf8mb4_bin').defaultTo('insert').comment('操作; insert, update, jhInsert, jhUpdate, jhDelete jhRestore');
      table.string('operationByUserId', 255).collate('utf8mb4_bin').nullable().comment('操作者userId');
      table.string('operationByUser', 255).collate('utf8mb4_bin').nullable().comment('操作者用户名');
      table.string('operationAt', 255).collate('utf8mb4_bin').nullable().comment('操作时间; E.g: 2021-05-28T10:24:54+08:00');
      // 表注释
      table.comment(`${typeName}辅助核算表`);
    })
      .then(() => {
        return knex.raw(`ALTER TABLE ?? ADD UNIQUE ?? (??, ??) USING BTREE COMMENT 'appaId_assistId_unique' COLLATE 'utf8mb4_bin'`, [tableName, 'appaId_assistId_unique', 'appaId', 'assistId']);
      })
      .catch(err => {
        // 处理错误
        console.error(err);
      });
  }

  async deleteAppAccount(actionData) {
    validateUtil.validate(actionDataScheme.deleteAppAccount, actionData);

    const { appaId } = actionData
    const { knex } = this.app;

    const deleteTableList = [
      tableEnum._app_account,
      tableEnum.period,
      tableEnum.subject,
      tableEnum.subject_balance_period,
      tableEnum.subject_balance_year,
      tableEnum.subject_balance_year_adjust,
      tableEnum.voucher,
      tableEnum.voucher_entry,
      tableEnum.assist_customer,
      tableEnum.assist_supplier,
      tableEnum.assist_staff,
      tableEnum.assist_project,
      tableEnum.assist_depart,
      tableEnum.report_asset_liability_formula,
      tableEnum.report_asset_liability_item,
      tableEnum.report_cash_flow_ex_formula,
      tableEnum.report_cash_flow_ex_item,
      tableEnum.report_cash_flow_item,
      tableEnum.report_cash_flow_item3,
      tableEnum.report_profit_formula,
      tableEnum.report_profit_item,
      tableEnum.report_summary_item,
      tableEnum.voucher_template,
      tableEnum.currency,
    ];


    await knex.transaction(async trx => {
      await Promise.all(deleteTableList.map(async (table) => {
        await trx(table).where({ appaId }).delete();
        // const appAccountList =  await trx(tableEnum._app_account).select();
        // const appaIdList = appAccountList.map(appAccount => appAccount.appaId);
        // await trx(table).whereNotIn('appaId', appaIdList).delete();
      }))
    })
  }

  // 归档报表数据
  async archiveAppAcount(actionData) {
    const { jianghuKnex, knex, config } = this.app;
    const { periodId: _periodId } = actionData
    const { appaId } = this.ctx.request.body.appData
    // userId
    const { userId } = this.ctx.userInfo;

    // 如果periodId为年度，则归档整个年度的数据
    let periodIdList = [_periodId];
    if (_periodId.length == 4) {
      const periodList = await jianghuKnex(tableEnum.period, this.ctx).where('periodId', 'like', `${_periodId}%`).select();
      periodIdList = periodList.map(period => period.periodId);
    }

    for (const periodId of periodIdList) {

      const [
        { rows: cashFlowList },
        { rows: itemList, assetList, liabilityList },
        { rows: detailSubjectList, debitSubjectList, creditSubjectList },
        { rows: profitList },
        voucherEntryList,
        subjectBalanceList,
      ] = await Promise.all([
        // 现金流量表
        this.ctx.service.report.getItemListOfCashFlow3({ periodId }),
        // 资产负债表
        this.ctx.service.report.getItemListOfAssetLiability({ periodId }),
        // 明细账
        this.ctx.service.account.getItemListOfMulticolumnLedger({ periodIdList: [periodId], subjectId: 1001 }),
        // 利润账
        this.ctx.service.report.getItemListOfProfit({ periodId }),
        // 序时账
        jianghuKnex(tableEnum.view01_voucher_entry, this.ctx).where({ periodId }).select(),
        // 余额账
        jianghuKnex(tableEnum.view01_subject_balance_period, this.ctx).where({ periodId }).select(),
      ])

      assetList.forEach((item, index) => {
        item.itemName2 = liabilityList[index]?.itemName;
        item.row2 = liabilityList[index]?.row;
        item.formulaCount2 = liabilityList[index]?.formulaCount;
        item.itemStartAmountPeriod2 = liabilityList[index]?.itemStartAmountPeriod;
        item.itemEndAmountPeriod2 = liabilityList[index]?.itemEndAmountPeriod;
        item.itemStartAmountYear2 = liabilityList[index]?.itemStartAmountYear;
        item.itemEndAmountYear2 = liabilityList[index]?.itemEndAmountYear;
        item.formulaCount2 = liabilityList[index]?.formulaCount;
        item.editable2 = liabilityList[index]?.editable;
        item.computeFormula2 = liabilityList[index]?.computeFormula;
      })
      // TODO: headers调整
      const dataList = [
        {
          name: '现金流量表', data: cashFlowList, headers: [
            { text: "行次", value: "row" },
            { text: "项目", value: "itemName" },
            { text: "本期数", value: "itemAmountPeriod" },
            { text: "本年数", value: "itemAmountYear" },
            { text: "本月数-行公式", value: "computeFormula" },
            { text: "本年数-行公式", value: "computeFormula2" },
          ]
        },
        {
          name: '资产负债表', data: assetList, headers: [
            { text: "资产", value: "itemName" },
            { text: "行次", value: "row" },
            { text: "公式数-科目", value: "formulaCount" },
            { text: "期末数", value: "itemEndAmountPeriod" },
            { text: "年初数", value: "itemStartAmountYear" },

            { text: "负债和所有者权益", value: "itemName2" },
            { text: "行次", value: "row2" },
            { text: "公式数-科目", value: "formulaCount2" },
            { text: "期末数", value: "itemEndAmountPeriod2" },
            { text: "年初数", value: "itemStartAmountYear2" },

            { text: "期末数-行公式", value: "computeFormula" },
            { text: "科目公式", value: "formulaListStr" },
            { text: "科目(取值)公式", value: "formulaListStr2" },
          ]
        },
        {
          name: '明细账', data: detailSubjectList, headers: [
            { text: "日期", value: "voucherAt" },
            { text: "凭证字号", value: "voucherId" },
            { text: "摘要", value: "entryAbstract" },
            { text: "借方金额", value: "debit" },
            { text: "贷方金额", value: "credit" },
            { text: "方向", value: "subjectBalanceDirection" },
            { text: "余额", value: "balance" },
          ]
        },
        {
          name: '利润账', data: profitList, headers: [
            { text: "项目", value: "itemName" },
            { text: "行次", value: "row" },
            { text: "公式数-科目", value: "formulaCount" },
            { text: "本期累计金额", value: "itemOccurAmountPeriod" },
            { text: "本年累计金额", value: "itemOccurAmountYear" },
            { text: "本月累计金额-行公式", value: "computeFormula" },
            { text: "本年累计金额-行公式", value: "computeFormula2" },
            { text: "科目公式", value: "formulaListStr" },
            { text: "科目(取值)公式", value: "formulaListStr2" },
          ]
        },
        {
          name: '序时账', data: voucherEntryList, headers: [
            { text: "日期", value: "voucherAt" },
            { text: "凭证字号", value: "voucherId" },
            { text: "摘要", value: "entryAbstract" },
            { text: "科目编码", value: "subjectId" },
            { text: "科目名称", value: "subjectLabel" },
            { text: "借方金额", value: "debit" },
            { text: "贷方金额", value: "credit" },
            { text: "制单人", value: "voucherAccountant" },
            { text: "附件数", value: "voucherFileCount" },
          ]
        },
        {
          name: '余额账', data: subjectBalanceList, headers: [
            { text: "科目编码", value: "subjectId" },
            { text: "科目名称", value: "subjectName" },
            { text: "科目显示", value: "isShown" },
            { text: "余额方向", value: "subjectBalanceDirection" },

            { text: "期初余额", value: "startAmount" },
            { text: "本期发生额-借方", value: "occurDebit" },
            { text: "本期发生额-贷方", value: "occurCredit" },
            { text: "期末余额", value: "endAmount" },

            { text: "年初余额", value: "startAmountYear" },
            { text: "本年累计发生额-借方", value: "occurDebitYear" },
            { text: "本年累计发生额-贷方", value: "occurCreditYear" },
            { text: "年末余额", value: "endAmountYear" },
          ]
        },
      ];
      const insertData = {
        appaId,
        periodId,
        files: []
      }

      // 遍历数据列表，创建并保存Excel文件  
      for (let data of dataList) {
        const { name, data: sheetData, headers } = data;
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(name);

        worksheet.addRow(headers.map(item => item.text));

        for (let rowData of sheetData) {
          const rowItem = headers.map(item => rowData[item.value])
          worksheet.addRow(rowItem);
        }

        // 生成文件名和文件路径  
        const fileName = `${name}.xlsx`;

        // 文件保存路径,要按userId,aapaId,periodId来保存
        const filePath = path.join(__dirname, '..', '..', 'upload', 'archive', userId, appaId, periodId, fileName);
        // 检查文件夹是否存在，如果不存在则创建
        const dirPath = path.join(__dirname, '..', '..', 'upload', 'archive', userId, appaId, periodId);
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }

        const insertItem = {
          fileName: fileName.replace('.xlsx', ''),
          fileFullName: fileName,
          fileSize: 0,
          createAt: dayjs().format('YYYY-MM-DD HH:ss:mm'),
          filePath: `/${config.appId}/upload/archive/${userId}/${appaId}/${periodId}/${fileName}`,
        }
        // 检查文件是否存在，如果存在则覆盖保存  
        if (fs.existsSync(filePath)) {
          // 文件已存在，进行覆盖保存  
          fs.unlinkSync(filePath);
        }

        // 保存Excel文件到本地目录  
        await workbook.xlsx.writeFile(filePath);

        const stats = fs.statSync(filePath);
        insertItem.fileSize = stats.size;

        insertData.files.push(insertItem)
      };


      insertData.files = JSON.stringify(insertData.files);
      // 先删除app_account_file表中的数据
      await jianghuKnex('app_account_file', this.ctx).where({ periodId }).delete();
      await jianghuKnex('app_account_file', this.ctx).jhInsert(insertData);
    }
  }

  // 账套数据更新
  async updateAppAccountData(){
    const { knex } = this.app;
    const appAccountLsit = await knex(tableEnum._app_account, this.ctx).select();

    for (const appAccount of appAccountLsit) {
      const { appaId, appaStandard } = appAccount;
      this.ctx.request.body.appData.appaId = appaId;
      await this.ctx.service.subject.getAmendSubjectList();
      const mbCashFlowList = await knex('mb_report_cash_flow_item3', this.ctx).where({ appaId: appaStandard }).select();
      const appaCashFlowList = await knex(tableEnum.report_cash_flow_item3, this.ctx).where({ appaId }).select();
      if (mbCashFlowList.length != appaCashFlowList.length) {
        const appaCashFlowList = mbCashFlowList.map((mbCashFlow) => {
          mbCashFlow.id = null;
          return { ...mbCashFlow, appaId, id: null, operation: null, operationByUserId: null, operationByUser: null, operationAt: null };
        })
        await knex(tableEnum.report_cash_flow_item3, this.ctx).where({ appaId }).delete();
        await knex(tableEnum.report_cash_flow_item3, this.ctx).insert(appaCashFlowList);
      }
    }    
  }
}

module.exports = AppAccountService;