const Service = require('egg').Service;
const _ = require('lodash');
const dayjs = require('dayjs');
const idGenerateUtil = require("@jianghujs/jianghu/app/common/idGenerateUtil");
const validateUtil = require('@jianghujs/jianghu/app/common/validateUtil');
const { subjectCategoryEnum, tableEnum } = require('../constant/constant');
const { BizError, errorInfoEnum } = require('../constant/error');

const actionDataScheme = Object.freeze({
  createSubject: {
    type: 'object',
    additionalProperties: true,
    required: ['subjectId', 'subjectName', 'subjectCategory', 'subjectBalanceDirection'],
    properties: {
      force: { anyOf: [{ type: "boolean" }, { type: "null" }] },
      assistList: { anyOf: [{ type: "string" }, { type: "null" }] },
      currencyList: { anyOf: [{ type: "string" }, { type: "null" }] },
      subjectIdTotal: { anyOf: [{ type: "string" }, { type: "number" }, { type: "null" }] },
      subjectId: { anyOf: [{ type: "string" }, { type: "number" }] },
      subjectName: { anyOf: [{ type: "string" }, { type: "number" }] },
      subjectCategory: { type: "string", enum: ['资产', '负债', '权益', '成本', '损益'] },
      subjectBalanceDirection: { type: "string", enum: ['借', '贷'] },
    },
  },
  updateSubject: {
    type: 'object',
    additionalProperties: true,
    required: ['subjectId', 'subjectName'],
    properties: {
      subjectId: { anyOf: [{ type: "string" }, { type: "number" }] },
      assistList: { anyOf: [{ type: "string" }, { type: "null" }] },
      currencyList: { anyOf: [{ type: "string" }, { type: "null" }] },
      subjectName: { anyOf: [{ type: "string" }, { type: "number" }] }
    },
  },
  removeSubject: {
    type: 'object',
    additionalProperties: true,
    required: ['subjectId'],
    properties: {
      subjectId: { anyOf: [{ type: "string" }, { type: "number" }] },
    },
  },

  getSubjectCashflowVoucherList: {
    type: 'object',
    additionalProperties: true,
    required: ['itemId'],
    properties: {
      itemId: { anyOf: [{ type: "string" }, { type: "number" }] },
      periodId: { anyOf: [{ type: "string" }] },
    },
  }
});

class SubjectService extends Service {
  async createSubject() {
    const { jianghuKnex } = this.app
    const ctx = this.ctx;
    const actionData = this.ctx.request.body.appData.actionData;
    validateUtil.validate(actionDataScheme.createSubject, actionData);
    const { force,
      subjectIdTotal,
      subjectId, subjectName,
      subjectCategory, subjectBalanceDirection, assistList, currencyList } = actionData
    const subjectLevel = (`${subjectId}`.length - 2) / 2;

    const periodList = await jianghuKnex(tableEnum.period, this.ctx).select();
    const subjectList = await jianghuKnex(tableEnum.subject, this.ctx).select();

    const currentPeriod = periodList.find(period => period.isCheckout === '待结账');
    const subjectBalanceList = periodList.map(period => {
      return {
        subjectId,
        financeYear: period.financeYear,
        periodId: period.periodId,
        isPeriodStart: period.isPeriodStart,
      }
    });
    const financeYearMap = _.groupBy(periodList, 'financeYear');
    const financeYearList = Object.keys(financeYearMap);
    const subjectBalanceYearList = financeYearList.map(financeYear => {
      return {
        subjectId,
        financeYear,
      }
    });

    let subjectLabel = this.computeSubjectLabel(subjectId, subjectName, subjectList)

    await jianghuKnex.transaction(async trx => {
      // Tip: 将有下级科目的数据全部转移到新增的下级科目中
      if (subjectIdTotal) {
        await trx(tableEnum.subject, this.ctx).where({ subjectId: subjectIdTotal }).update({ subjectHasChildren: '有下级科目' });
        const totalVoucherEntryList = await trx(tableEnum.voucher_entry, this.ctx).where({ subjectId: subjectIdTotal }).select('id');
        if (totalVoucherEntryList.length > 0 && force !== true) {
          throw new BizError(errorInfoEnum.subject_has_voucher_entry)
        }
        if (totalVoucherEntryList.length > 0 && force === true) {
          await trx(tableEnum.voucher_entry, this.ctx).where({ subjectId: subjectIdTotal }).update({ subjectId });
        }
      }

      // 补充现金流量对照
      const insertSubject = {
        subjectId, subjectName, subjectLabel,
        subjectCategory, subjectLevel, subjectHasChildren: '无下级科目',
        subjectBalanceDirection, assistList, currencyList
      }
      const [newInsertSubject] = await this._amendSubjectCashflow([insertSubject])

      await trx(tableEnum.subject, this.ctx).insert(newInsertSubject);
      if (subjectBalanceList.length > 0) {
        await trx(tableEnum.subject_balance_period, this.ctx).where({ subjectId }).delete();
        await trx(tableEnum.subject_balance_period, this.ctx).insert(subjectBalanceList);
      }
      if (subjectBalanceYearList.length > 0) {
        await trx(tableEnum.subject_balance_year, this.ctx).where({ subjectId }).delete();
        await trx(tableEnum.subject_balance_year, this.ctx).insert(subjectBalanceYearList);
      }
    })

    // Tip: 因为凭证变动 这里重新触发 科目余额计算
    if (currentPeriod) {
      await this.ctx.service.period.computeSubjectBalancePeriod({ periodId: currentPeriod.periodId });
    }

  }

  async updateSubject() {
    const { jianghuKnex } = this.app
    const ctx = this.ctx;
    const actionData = this.ctx.request.body.appData.actionData;
    validateUtil.validate(actionDataScheme.updateSubject, actionData);
    const { subjectId, subjectName, assistList, currencyList, isShown } = actionData
    let subjectList = await jianghuKnex(tableEnum.subject, this.ctx).select();

    let subjectLabel = this.computeSubjectLabel(subjectId, subjectName, subjectList);
    await jianghuKnex(tableEnum.subject, this.ctx).where({ subjectId }).update({
      subjectName, subjectLabel, assistList, currencyList, isShown
    });

    // 更新科目列表中的subjectName
    subjectList.find(subject => subject.subjectId === subjectId).subjectName = subjectName;
    // 更新子科目的subjectLabel
    const childSubjectList = await jianghuKnex(tableEnum.subject, this.ctx).where('subjectId', 'like', `${subjectId}%`).select();
    for (let childSubject of childSubjectList) {
      const childSubjectLabel = this.computeSubjectLabel(childSubject.subjectId, childSubject.subjectName, subjectList);
      await jianghuKnex(tableEnum.subject, this.ctx).where({ subjectId: childSubject.subjectId }).update({ subjectLabel: childSubjectLabel });
    }
  }

  computeSubjectLabel(subjectId, subjectName, subjectList) {
    // 获取父级IDList
    let parentSubjectIdLinkList = [];
    let parentSubjectIdLength = 4;
    while (parentSubjectIdLength < subjectId.length) {
      parentSubjectIdLinkList.push(subjectId.slice(0, parentSubjectIdLength));
      parentSubjectIdLength += 2;
    }
    // 获取名称
    const parentSubjectIdLinkNameList = parentSubjectIdLinkList.map(parentSubjectIdLink => {
      const parentSubject = subjectList.find(subject => subject.subjectId === parentSubjectIdLink) || {};
      return parentSubject.subjectName;
    })
    // 添加当前科目名称
    parentSubjectIdLinkNameList.push(subjectName);
    return parentSubjectIdLinkNameList.join('_');
  }


  async removeSubject() {
    const { jianghuKnex } = this.app
    const ctx = this.ctx;
    const actionData = this.ctx.request.body.appData.actionData;
    validateUtil.validate(actionDataScheme.removeSubject, actionData);
    const { subjectId } = actionData
    const subject = await jianghuKnex(tableEnum.subject, this.ctx).where({ subjectId }).select().first();
    if (!subject) {
      throw new BizError(errorInfoEnum.subject_not_exist)
    }
    if (subject.subjectHasChildren !== '无下级科目') {
      throw new BizError({
        errorCode: errorInfoEnum.subject_can_not_be_remove.errorCode,
        errorReason: '有下级科目' + errorInfoEnum.subject_can_not_be_remove.errorReason,
      })
    }

    const voucherEntryList = await jianghuKnex(tableEnum.voucher_entry, this.ctx).where({ subjectId }).select('id');
    if (voucherEntryList.length > 0) {
      throw new BizError(errorInfoEnum.subject_has_voucher_entry)
    }

    // TODO: 检查是否有 公式正在使用当前科目
    const assetLiabilityFormulaList = await jianghuKnex(tableEnum.report_asset_liability_formula, this.ctx).where({ subjectId }).select('id');
    const profitFormulaFormulaList = await jianghuKnex(tableEnum.report_profit_formula, this.ctx).where({ subjectId }).select('id');
    const cashFlowExFormulaList = await jianghuKnex(tableEnum.report_cash_flow_ex_formula, this.ctx).where({ subjectId }).select('id');
    if (assetLiabilityFormulaList.length > 0 || profitFormulaFormulaList.length > 0 || cashFlowExFormulaList.length > 0) {
      throw new BizError(errorInfoEnum.subject_report_formula)
    }
    const { subjectLevel } = subject;

    await jianghuKnex.transaction(async trx => {
      await trx(tableEnum.subject, ctx).where({ subjectId }).jhDelete();

      // Tip: 更新上级科目 状态
      if (subjectLevel > 1) {
        const subjectIdTotal = `${subjectId}`.substring(0, subjectId.length - 2);
        const subjectTotalDetailList = await trx(tableEnum.subject, this.ctx)
          .whereRaw('subjectId like ?', [`${subjectIdTotal}%`])
          .whereNotIn('subjectId', [subjectId, subjectIdTotal])
          .select('id');
        if (subjectTotalDetailList.length === 0) {
          await trx(tableEnum.subject, this.ctx).where({ subjectId: subjectIdTotal }).jhUpdate({ subjectHasChildren: '无下级科目' });
        }
      }

    })
  }

  getSubjectAssist({ assistIdOfCustomer, assistIdOfSupplier, assistIdOfStaff, assistIdOfProject, assistIdOfDepart, assistNameOfCustomer, assistNameOfSupplier, assistNameOfStaff, assistNameOfProject, assistNameOfDepart }) {
    return { assistIdOfCustomer, assistNameOfCustomer, assistIdOfSupplier, assistNameOfSupplier, assistIdOfStaff, assistNameOfStaff, assistIdOfProject, assistNameOfProject, assistIdOfDepart, assistNameOfDepart };
  }

  async getAmendSubjectList() {
    const { jianghuKnex, knex } = this.app

    const [subjects, mbSubjects] = await Promise.all([
      jianghuKnex(tableEnum.subject, this.ctx).select(),
      knex('mb_subject').where({ appaId: '小企业会计准则' }).select(),
    ])

    const updatedSubjects = subjects.map(subject => {
      let subjectCategory;
      let subjectHasChildren = '无下级科目'
      let subjectLabel = subject.subjectName;

      const subjectLevel = (`${subject.subjectId}`.length - 2) / 2;
      // subjectCategory
      switch (subject.subjectId.charAt(0)) {
        case '1':
          subjectCategory = '资产';
          break;
        case '2':
          subjectCategory = '负债';
          break;
        case '3':
          subjectCategory = '权益';
          break;
        case '4':
          subjectCategory = '成本';
          break;
        case '5':
          subjectCategory = '损益';
          break;
        default:
          subjectCategory = '其他';
      }

      // subjectHasChildren的计算,如果subjects中有subjectId是以当前subjectId开头的,则subjectHasChildren为'有下级科目'
      if (subjects.find(item => item.subjectId.startsWith(subject.subjectId) && item.subjectId !== subject.subjectId)) {
        subjectHasChildren = '有下级科目';
      }

      subjectLabel = this.computeSubjectLabel(subject.subjectId, subject.subjectName, subjects)

      const subjectTag = this._amendSubjectTag({ subject, mbSubjects });

      if (
        subject.subjectCategory !== subjectCategory ||
        subject.subjectHasChildren !== subjectHasChildren ||
        subject.subjectLabel !== subjectLabel ||
        subject.subjectLevel !== subjectLevel ||
        subject.subjectTag !== subjectTag
      ) {
        return {
          ...subject,
          subjectCategory,
          subjectHasChildren,
          subjectLabel,
          subjectLevel,
          subjectTag,
        };
      }

      return subject;
    });


    const updatePromises = updatedSubjects.map(updatedSubject => {
      const originalSubject = subjects.find(subject => subject.subjectId === updatedSubject.subjectId);
      if (originalSubject &&
        (
          updatedSubject.subjectCategory != originalSubject.subjectCategory ||
          updatedSubject.subjectLabel != originalSubject.subjectLabel ||
          updatedSubject.subjectHasChildren != originalSubject.subjectHasChildren ||
          updatedSubject.subjectLevel != originalSubject.subjectLevel ||
          updatedSubject.subjectTag != originalSubject.subjectTag
        )) {
        return jianghuKnex(tableEnum.subject, this.ctx)
          .where({ subjectId: updatedSubject.subjectId })
          .update({
            subjectLabel: updatedSubject.subjectLabel,
            subjectCategory: updatedSubject.subjectCategory,
            subjectHasChildren: updatedSubject.subjectHasChildren,
            subjectLevel: updatedSubject.subjectLevel,
            subjectTag: updatedSubject.subjectTag,
          });
      }
    }).filter(item => item);

    await Promise.all(updatePromises);

    return { rows: updatedSubjects };
  }

  // subjectTag，小标签，加一些便于统一搜索的提示字:父,子,辅,新,借,贷
  _amendSubjectTag({ subject, mbSubjects }) {

    let subjectTag = '';
    const isNewSubject = !mbSubjects.find(item => item.subjectId === subject.subjectId)

    if (isNewSubject) {
      subjectTag += '新,'
    }
    subjectTag += `${subject.subjectBalanceDirection},`

    // 父子的判断是根据subjectId的长度来判断的，为4的是父级
    if (subject.subjectId.length === 4) {
      subjectTag += '父,'
    } else {
      subjectTag += '子,'
    }

    // 辅助核算
    if (subject.assistList) {
      subjectTag += '辅,'
    }

    // 外币核算
    if (subject.assistList) {
      subjectTag += '币,'
    }

    return subjectTag;
  }

  // 修正科目现金流量对照
  async _amendSubjectCashflow(subjectList) {
    const { knex } = this.app
    const mbSubjectList = await knex('mb_subject').where({ appaId: '小企业会计准则' }).select()


    subjectList.forEach(cashflow => {
      const currentSubject = mbSubjectList.find(subject => subject.subjectId === cashflow.subjectId);
      Object.assign(cashflow, currentSubject);

      cashflow.subjectId = String(cashflow.subjectId)
      const parentSubjectId = cashflow.subjectId.slice(0, cashflow.subjectId.length - 2);
      // 如果 cashFlowInItemName 为空，尝试从父级获取
      if (!cashflow.cashFlowInItemName && parentSubjectId) {
        const parentCashflow = mbSubjectList.find(subject => subject.subjectId === parentSubjectId);

        if (parentCashflow && parentCashflow.cashFlowInItemId) {
          cashflow.cashFlowInItemName = parentCashflow.cashFlowInItemName;
          cashflow.cashFlowInItemId = parentCashflow.cashFlowInItemId;
        }
      }

      // 如果 cashFlowOutItemName 为空，尝试从父级获取
      if (!cashflow.cashFlowOutItemName && parentSubjectId) {
        const parentCashflow = mbSubjectList.find(subject => subject.subjectId === parentSubjectId);

        if (parentCashflow && parentCashflow.cashFlowOutItemId) {
          cashflow.cashFlowOutItemName = parentCashflow.cashFlowOutItemName;
          cashflow.cashFlowOutItemId = parentCashflow.cashFlowOutItemId;
        }
      }

      if (!cashflow.cashFlowInItemName && parentSubjectId) {
        const childSubject = mbSubjectList
          .filter(subject => subject.subjectId.startsWith(parentSubjectId))
          .filter(subject => subject.cashFlowInItemId);

        if (childSubject.length > 0) {
          cashflow.cashFlowInItemName = childSubject[0].cashFlowInItemName;
          cashflow.cashFlowInItemId = childSubject[0].cashFlowInItemId;
        }
      }

      if (!cashflow.cashFlowOutItemName && parentSubjectId) {
        const childSubject = mbSubjectList
          .filter(subject => subject.subjectId.startsWith(parentSubjectId))
          .filter(subject => subject.cashFlowOutItemId);

        if (childSubject.length > 0) {
          cashflow.cashFlowOutItemName = childSubject[0].cashFlowOutItemName;
          cashflow.cashFlowOutItemId = childSubject[0].cashFlowOutItemId;
        }
      }
    })

    return subjectList
  }

  async resetSubjectCashflow(actionData) {
    const { jianghuKnex, knex } = this.app

    // 重新再取一份模板数据mb_subject
    const subjectList = await jianghuKnex(tableEnum.subject, this.ctx).select();

    const updateData = await this._amendSubjectCashflow(subjectList);
    const updateDataPromise = [];
    for (let cashflow of updateData) {
      updateDataPromise.push(
        jianghuKnex(tableEnum.subject, this.ctx).where({ subjectId: cashflow.subjectId }).update({
          cashFlowInItemId: cashflow.cashFlowInItemId,
          cashFlowInItemName: cashflow.cashFlowInItemName,
          cashFlowOutItemId: cashflow.cashFlowOutItemId,
          cashFlowOutItemName: cashflow.cashFlowOutItemName,
        })
      )
    }

    // 更新subject cashflow对照
    await Promise.all(updateDataPromise)
  }

  // 查subject_cash_flow，找到对应itemId的科目，并根据科目查凭证
  async getSubjectCashflowVoucherList(actionData) {
    const { jianghuKnex, knex } = this.app

    validateUtil.validate(actionDataScheme.getSubjectCashflowVoucherList, actionData);
    const { itemId, periodId, periodTimeType } = actionData;
    const financeYear = dayjs(periodId).year();
    let periodList = await jianghuKnex(tableEnum.period, this.ctx)
      .where({ financeYear })
      .select();

    let periodIdList = [periodId]
    if (periodTimeType === 'year') {
      periodList = periodList.filter(period => period.periodId <= periodId);
      periodIdList = periodList.map(period => period.periodId);
    }

    const xianjinSubjectList = await jianghuKnex(tableEnum.subject, this.ctx).where({'cashFlowInItemName':'现金及现金等价物'}).select();
    const xianjinSubjectIdList = xianjinSubjectList.map(s => s.subjectId);

    const cashFlowSubjectList = await jianghuKnex(tableEnum.subject, this.ctx).whereRaw('cashFlowInItemId = ? or cashFlowOutItemId = ?', [itemId, itemId]).select();
    const cashFlowSubjectIdList = cashFlowSubjectList.map(item => item.subjectId);


    let rows = await jianghuKnex(tableEnum.view01_voucher_entry, this.ctx)
      .whereIn('subjectId', cashFlowSubjectIdList)
      .whereIn('periodId', periodIdList)
      .whereRaw(`ifnull(voucherTemplateName,'') not like '结转损益%'`)
      .select();

    const voucherIdList = rows.map(item => item.voucherId);
    const voucherEntryList = await jianghuKnex(tableEnum.view01_voucher_entry, this.ctx)
      .whereIn('voucherId', voucherIdList)
      .select();
    const voucherEntryListGroup = _.groupBy(voucherEntryList, 'voucherId');
    rows = rows.filter(row => {
      const {voucherId} = row;
      const rowDirection = row.debit == 0 ? '贷': '借';
      const entryList = voucherEntryListGroup[voucherId];
      const xianjinEntry = entryList.find(entry => xianjinSubjectIdList.includes(entry.subjectId));
      if (!xianjinEntry) { return false; }
      const xianjinDirection = xianjinEntry.debit == 0 ? '贷': '借';
      if (rowDirection == xianjinDirection) { return false; }
      if (rowDirection == '借') {
        row.debit = row.debit > xianjinEntry.credit ? xianjinEntry.credit : row.debit;
      }
      if (rowDirection == '贷') {
        row.credit = row.credit > xianjinEntry.debit ? xianjinEntry.debit : row.credit;
      }
      return true;
    })  

    // TODO: xianjin科目的 金额< total 时，通过计算定位到 真正的 目标金额
    return { rows }
  }
}

module.exports = SubjectService;