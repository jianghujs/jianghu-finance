const Service = require('egg').Service;
const validateUtil = require('@jianghujs/jianghu/app/common/validateUtil');
const { tableEnum } = require('../constant/constant');
const _ = require('lodash');
const dayjs = require('dayjs');
const { errorInfoEnum, BizError } = require('../constant/error');

const actionDataScheme = Object.freeze({
  checkout: {
    type: 'object',
    additionalProperties: true,
    required: ['currentPeriodId', 'nextPeriodId'],
    properties: {
      currentPeriodId: { anyOf: [{ type: "string" }, { type: "number" }] },
      nextPeriodId: { anyOf: [{ type: "string" }, { type: "number" }] },
    },
  },
  reverseCheckout: {
    type: 'object',
    additionalProperties: true,
    required: ['currentPeriodId'],
    properties: {
      currentPeriodId: { anyOf: [{ type: "string" }, { type: "number" }] },
    },
  },
  checkSubjectBalance: {
    type: 'object',
    additionalProperties: true,
    required: ['periodId'],
    properties: {
      periodId: { anyOf: [{ type: "string" }, { type: "number" }] },
    },
  },
  checkCarryVoucher: {
    type: 'object',
    additionalProperties: true,
    required: ['periodId'],
    properties: {
      periodId: { anyOf: [{ type: "string" }, { type: "number" }] },
    },
  },
  createPeriodStart: {
    type: 'object',
    additionalProperties: true,
    required: ['periodId'],
    properties: {
      periodId: { anyOf: [{ type: "string" }, { type: "number" }] },
    },
  },
});

function getAssistInfoFromVoucherEntry(voucherEntry) {
  const { assistIdOfCustomer, assistNameOfCustomer, assistIdOfSupplier, assistNameOfSupplier, assistIdOfStaff, assistNameOfStaff, assistIdOfProject, assistNameOfProject, assistIdOfDepart, assistNameOfDepart } = voucherEntry;
  return { assistIdOfCustomer, assistNameOfCustomer, assistIdOfSupplier, assistNameOfSupplier, assistIdOfStaff, assistNameOfStaff, assistIdOfProject, assistNameOfProject, assistIdOfDepart, assistNameOfDepart };
}

class PeriodService extends Service {

  async createPeriodStart(actionData) {
    const { jianghuKnex } = this.app;
    validateUtil.validate(actionDataScheme.createPeriodStart, actionData);
    const { periodId } = actionData;
    const financeYear = dayjs(periodId).year();
    const subjectList = await jianghuKnex(tableEnum.subject, this.ctx).select();
    const subjectBalancePeriodList = subjectList.map(subject => ({
      periodId, financeYear,
      subjectId: subject.subjectId,
      isPeriodStart: '是',
    }));
    const subjectBalanceYearList = subjectList.map(subject => ({
      financeYear,
      subjectId: subject.subjectId,
    }));

    await jianghuKnex.transaction(async trx => {
      await trx(tableEnum.period, this.ctx).insert({
        periodId, financeYear,
        isCheckout: '待结账',
        isPeriodStart: '是'
      });

      await trx(tableEnum.subject_balance_period, this.ctx).delete();
      await trx(tableEnum.subject_balance_year, this.ctx).delete();
      await trx(tableEnum.subject_balance_period, this.ctx).insert(subjectBalancePeriodList);
      await trx(tableEnum.subject_balance_year, this.ctx).insert(subjectBalanceYearList);
    });

    // 5. 计算 科目余额(next期间)
    await this.computeSubjectBalance({ periodId });
  }

  async saveSubjectBalanceStart() {
    const ctx = this.ctx;
    const { jianghuKnex } = this.app;
    const actionData = this.ctx.request.body.appData.actionData;
    const { subjectBalanceStartList } = actionData;

    const insertItemList = subjectBalanceStartList
      .map(sbs => { return _.pick(sbs, ['subjectId', 'subjectCategory', 'subjectBalanceDirection', 'subjectHasChildren', 'assistChildrenList', 'startDebitPeriod', 'startCreditPeriod', 'startDebitYear', 'startCreditYear', 'occurDebitYear', 'occurCreditYear', 'occurAmountYear']); })
      .map(sbs => { return _.pickBy(sbs, (value) => !!value); })
      .filter(row => row.assistChildrenList.length > 0 || row.startDebitPeriod || row.startCreditPeriod || row.startDebitYear || row.startCreditYear || row.occurDebitYear || row.occurCreditYear || row.occurAmountYear);

    const period = await jianghuKnex(tableEnum.period, this.ctx).where({ isPeriodStart: '是' }).select().first();
    if (!period) {
      throw new BizError(errorInfoEnum.period_not_exist);
    }
    if (period.isCheckout !== '待结账') {
      throw new BizError(errorInfoEnum.period_has_checkout);
    }
    const periodId = period.periodId;

    const periodIdLeiji = `${period.financeYear}-00`;
    const voucherNameLeiji = "累计"
    const voucherNumberLeiji = 0;
    const voucherIdLeiji = `${periodIdLeiji}-${voucherNameLeiji}-${voucherNumberLeiji}`;
    const voucherTypeLeiji = "累计";
    const voucherLeiji = {
      periodId: periodIdLeiji,
      voucherName: voucherNameLeiji, voucherNumber: voucherNumberLeiji, voucherId: voucherIdLeiji,
      voucherType: voucherTypeLeiji
    };

    const periodIdCheckout = `${period.financeYear}-00`;
    const voucherNameCheckout = "累计"
    const voucherNumberCheckout = 1;
    const voucherIdCheckout = `${periodIdCheckout}-${voucherNameCheckout}-${voucherNumberCheckout}`;
    const voucherTypeCheckout = "累计";
    const voucherCheckout = {
      periodId: periodIdLeiji,
      voucherName: voucherNameCheckout, voucherNumber: voucherNumberCheckout, voucherId: voucherIdCheckout,
      voucherType: voucherTypeCheckout,
      voucherTemplateName: '结转损益-本期',
    };

    const voucherEntryListLeiji = [];
    const voucherEntryListCheckout = [];
    const assistKeyList = ['customer', 'depart', 'project', 'staff', 'supplier', 'cashflow'];
    const assistChildrenListGroup = insertItemList.map(item => item.assistChildrenList);
    const assistChildrenListAll = _.concat(...assistChildrenListGroup);
    // TODO: 有对象不一定代表 开启了辅助项，也有可能是 开启后关闭===》待优化
    if (assistChildrenListAll.length > 0) {
      assistChildrenListAll.forEach(child => {
        const parentSubjectId = child.subjectId.split('_')[0];
        const assistIdObj = {};
        const assistNameObj = {};
        const assistKeyListTarget = assistKeyList.filter(assistKey => child[assistKey]);
        assistKeyListTarget.forEach(assistKey => {
          assistIdObj[`assistIdOf${assistKey}`] = child[assistKey].assistId;
          assistNameObj[`assistNameOf${assistKey}`] = child[assistKey].assistName;
        });

        if (child.subjectCategory !== '损益') {
          voucherEntryListLeiji.push({
            voucherId: voucherIdLeiji,
            subjectId: parentSubjectId,
            entryAbstract: '年中启用账套累计(辅助项)',
            debit: child.occurDebitYear || 0,
            credit: child.occurCreditYear || 0,
            ...assistIdObj, ...assistNameObj,
          })
        }
        if (child.subjectCategory === '损益') {
          voucherEntryListLeiji.push({
            voucherId: voucherIdLeiji,
            subjectId: parentSubjectId,
            entryAbstract: '年中启用账套累计(辅助项)',
            debit: child.subjectBalanceDirection === '借' ? child.occurAmountYear : 0,
            credit: child.subjectBalanceDirection === '贷' ? child.occurAmountYear : 0,
            ...assistIdObj, ...assistNameObj,
          })

          voucherEntryListCheckout.push({
            voucherId: voucherIdCheckout,
            subjectId: parentSubjectId,
            entryAbstract: '年中启用账套累计(辅助项)-结转',
            debit: child.subjectBalanceDirection === '借' ? 0 : child.occurAmountYear,
            credit: child.subjectBalanceDirection === '贷' ? 0 : child.occurAmountYear,
            ...assistIdObj, ...assistNameObj,
          })
        }
      })
    }

    insertItemList
      .filter(item => item.assistChildrenList.length == 0)
      .filter(item => item.subjectHasChildren == '无下级科目')
      .filter(item => item.occurDebitYear || item.occurCreditYear)
      .forEach(item => {
        if (item.subjectCategory !== '损益') {
          voucherEntryListLeiji.push({
            voucherId: voucherIdLeiji,
            subjectId: item.subjectId,
            entryAbstract: '年中启用账套累计',
            debit: item.occurDebitYear,
            credit: item.occurCreditYear,
          })
        }

        if (item.subjectCategory === '损益') {
          voucherEntryListLeiji.push({
            voucherId: voucherIdLeiji,
            subjectId: item.subjectId,
            entryAbstract: '年中启用账套累计',
            debit: item.subjectBalanceDirection === '借' ? item.occurAmountYear : 0,
            credit: item.subjectBalanceDirection === '贷' ? item.occurAmountYear : 0,
          })

          voucherEntryListCheckout.push({
            voucherId: voucherIdCheckout,
            subjectId: item.subjectId,
            entryAbstract: '年中启用账套累计-结转',
            debit: item.subjectBalanceDirection === '借' ? 0 : item.occurAmountYear,
            credit: item.subjectBalanceDirection === '贷' ? 0 : item.occurAmountYear,
          })
        }
      })


    await jianghuKnex.transaction(async trx => {
      await trx(tableEnum.subject_balance_start, this.ctx).delete();
      await trx(tableEnum.subject_balance_period, this.ctx).where({ periodId }).update({ startDebit: 0, startCredit: 0 });
      if (insertItemList.length > 0) {
        insertItemList.forEach(item => {
          delete item.subjectHasChildren;
          delete item.subjectCategory;
          delete item.subjectBalanceDirection;
          item.assistChildrenList = JSON.stringify(item.assistChildrenList || []);
        });
        await trx(tableEnum.subject_balance_start, this.ctx).insert(insertItemList);
        for (const insertItem of insertItemList) {
          await trx(tableEnum.subject_balance_period, this.ctx)
            .where({ periodId, subjectId: insertItem.subjectId })
            .update({ startDebit: insertItem.startDebitPeriod, startCredit: insertItem.startCreditPeriod });
        }
      }

      await trx(tableEnum.voucher, this.ctx).whereRaw('voucherId LIKE ?', ['%辅助%']).delete();
      await trx(tableEnum.voucher_entry, this.ctx).whereRaw('voucherId LIKE ?', ['%辅助%']).delete();
      await trx(tableEnum.voucher, this.ctx).whereRaw('voucherId LIKE ?', ['%累计%']).delete();
      await trx(tableEnum.voucher_entry, this.ctx).whereRaw('voucherId LIKE ?', ['%累计%']).delete();
      if (voucherEntryListLeiji.length > 0) {
        await trx(tableEnum.voucher, this.ctx).insert(voucherLeiji);
        await trx(tableEnum.voucher_entry, this.ctx).insert(voucherEntryListLeiji);
      }
      if (voucherEntryListCheckout.length > 0) {
        await trx(tableEnum.voucher, this.ctx).insert(voucherCheckout);
        await trx(tableEnum.voucher_entry, this.ctx).insert(voucherEntryListCheckout);
      }
    });

    await this.computeSubjectBalance({ periodId });
  }

  // 是否账套管理员
  async _isAppAccountAdmin() {
    const { jianghuKnex } = this.app;
    const { userId } = this.ctx.userInfo;
    const appAccount = await jianghuKnex(tableEnum._app_account, this.ctx).select().first();

    return userId === appAccount.appaManagerId;
  }
  async checkout(actionData) {
    const ctx = this.ctx;
    const { jianghuKnex } = this.app;
    validateUtil.validate(actionDataScheme.checkout, actionData);
    const { currentPeriodId, nextPeriodId, checkBalanceNeed = true } = actionData;
    const nextFinanceYear = dayjs(nextPeriodId).year();

    const currentPeriod = await jianghuKnex(tableEnum.period, this.ctx)
      .where({ periodId: currentPeriodId })
      .select()
      .first();
    if (!currentPeriod) {
      throw new BizError(errorInfoEnum.period_not_exist);
    }
    if (currentPeriod.isCheckout === '已结账') {
      throw new BizError(errorInfoEnum.period_has_checkout);
    }

    // TODO: 系统管理员也可
    // const isAppAccountAdmin = await this._isAppAccountAdmin();
    // if (!isAppAccountAdmin) {
    //   throw new BizError(errorInfoEnum.user_not_appa_manager);
    // }

    // 1. 更新 科目余额-年;  
    //    - 删除然后 创建新数据; ===> 优势: 容错性好; 
    const subjectList = await jianghuKnex(tableEnum.subject, this.ctx).select();
    const nextSubjectBalanceYearList = subjectList.map(subject => ({ financeYear: nextFinanceYear, subjectId: subject.subjectId }));
    await jianghuKnex.transaction(async trx => {
      await trx(tableEnum.subject_balance_year, this.ctx).where({ financeYear: nextFinanceYear }).delete();
      await trx(tableEnum.subject_balance_year, this.ctx).insert(nextSubjectBalanceYearList);
    })

    // 2. 计算 科目余额(本期间)
    await this.computeSubjectBalance({ periodId: currentPeriodId });

    // 3. 试算平衡(结账凭证检查)
    if (checkBalanceNeed) {
      const checkBalanceResult = await this.checkSubjectBalance({ periodId: currentPeriodId, isCheckCheckoutVoucher: true });
      if (!checkBalanceResult.isBalance) {
        return { checkoutSuccess: false, ...checkBalanceResult };
      }
    }

    // 4. 更新会计期间状态 & 创建 科目余额-期间
    const subjectBalancePeriodList = await jianghuKnex(tableEnum.view01_subject_balance_period, this.ctx)
      .where({ periodId: currentPeriodId }).select();
    await jianghuKnex.transaction(async trx => {
      await trx(tableEnum.period, this.ctx).where({ periodId: currentPeriodId }).update({ isCheckout: '已结账' });

      await trx(tableEnum.period, this.ctx).where({ periodId: nextPeriodId }).jhDelete();
      await trx(tableEnum.period, this.ctx).insert({ periodId: nextPeriodId, financeYear: nextFinanceYear, isCheckout: '待结账' });
      const nextSubjectBalanceList = subjectBalancePeriodList.map((subjectBalance) => ({
        periodId: nextPeriodId,
        financeYear: nextFinanceYear,
        subjectId: subjectBalance.subjectId,
        startDebit: subjectBalance.endDebit,
        startCredit: subjectBalance.endCredit,
        occurDebit: 0,
        occurCredit: 0,
        occurAmount: 0,
        endDebit: subjectBalance.endDebit,
        endCredit: subjectBalance.endCredit,
      }));
      await trx(tableEnum.subject_balance_period, this.ctx).where({ periodId: nextPeriodId }).jhDelete();
      await trx(tableEnum.subject_balance_period, this.ctx).jhInsert(nextSubjectBalanceList);
    })

    // 5. 计算 科目余额(next期间)
    await this.computeSubjectBalance({ periodId: nextPeriodId });

    return { checkoutSuccess: true };
  }

  async reverseCheckout(actionData) {
    const ctx = this.ctx;
    const { jianghuKnex } = this.app;
    validateUtil.validate(actionDataScheme.reverseCheckout, actionData);
    const { currentPeriodId, force } = actionData;

    // 1. 会计期间检查
    const currentPeriod = await jianghuKnex(tableEnum.period, this.ctx)
      .where({ periodId: currentPeriodId })
      .select()
      .first();
    if (!currentPeriod) {
      throw new BizError(errorInfoEnum.period_not_exist);
    }
    if (currentPeriod.isCheckout !== '待结账') {
      throw new BizError(errorInfoEnum.data_exception);
    }
    const prePeriod = await jianghuKnex(tableEnum.period, this.ctx)
      .whereRaw('periodId < ?', [currentPeriodId])
      .orderBy('periodId', 'desc')
      .select()
      .first();
    if (!prePeriod) {
      throw new BizError(errorInfoEnum.pre_period_not_exist);
    }
    const prePeriodId = prePeriod.periodId;

    // 2. 结账凭证检查
    //   - 当前会计有结账凭证，并且没有 force===true 时 则报错
    const carryVoucherList = await jianghuKnex(tableEnum.voucher, this.ctx)
      .where({ periodId: currentPeriodId, voucherType: '结账凭证' })
      .select('voucherId');
    const carryVoucherIdList = carryVoucherList.map(cv => cv.voucherId);
    if (force !== true && carryVoucherIdList.length > 0) {
      throw new BizError(errorInfoEnum.period_has_template_voucher);
    }

    // 3. 更新会计期间 & 科目余额-期间
    await jianghuKnex.transaction(async trx => {
      // 删除结账凭证
      if (force === true && carryVoucherIdList.length > 0) {
        await jianghuKnex.transaction(async trx => {
          await trx(tableEnum.voucher, this.ctx).whereIn('voucherId', carryVoucherIdList).jhDelete();
          await trx(tableEnum.voucher_entry, this.ctx).whereIn('voucherId', carryVoucherIdList).jhDelete();
        })
      }
      await trx(tableEnum.period, this.ctx).where({ periodId: currentPeriodId }).delete();
      await trx(tableEnum.subject_balance_period, this.ctx).where({ periodId: currentPeriodId }).delete();
      await trx(tableEnum.period, this.ctx).where({ periodId: prePeriodId }).update({ isCheckout: '待结账' });
    })

    // 4. 计算 科目余额(pre期间)
    await this.computeSubjectBalance({ periodId: prePeriodId });
  }

  async checkSubjectBalance(actionData) {
    const { jianghuKnex } = this.app;
    validateUtil.validate(actionDataScheme.checkSubjectBalance, actionData);
    const { periodId, isCheckCheckoutVoucher = false } = actionData;
    const period = await jianghuKnex(tableEnum.period, this.ctx)
      .where({ periodId }).select().first();
    if (!period) {
      throw new BizError(errorInfoEnum.period_not_exist);
    }



    let isBalance = true;
    let occurDebit, occurCredit, occurAmount = 0;
    let occurDebitYear, occurCreditYear, occurAmountYear = 0;
    let periodStartDebit, periodStartCredit, periodStartAmount = 0;
    let assetTotal, liabilityTotal, assetLiabilityTotalDiff = 0;
    let errorVoucherListOfCheckout = [];


    const { isPeriodStart } = period;
    const subjectBalancePeriodList = await jianghuKnex(tableEnum.view01_subject_balance_period, this.ctx)
      .where({ periodId, subjectHasChildren: '无下级科目' })
      .select();

    // 1. 科目余额-借贷发生额 试算平衡
    occurDebit = _.sumBy(subjectBalancePeriodList, 'occurDebit').toFixed(2);
    occurCredit = _.sumBy(subjectBalancePeriodList, 'occurCredit').toFixed(2);
    occurAmount = (occurDebit - occurCredit).toFixed(2);
    occurDebitYear = _.sumBy(subjectBalancePeriodList, 'occurDebitYear').toFixed(2);
    occurCreditYear = _.sumBy(subjectBalancePeriodList, 'occurCreditYear').toFixed(2);
    occurAmountYear = (occurDebitYear - occurCreditYear).toFixed(2);

    // 2. 科目余额-初始余额 试算平衡
    if (isPeriodStart === '是') {
      const debitList = subjectBalancePeriodList.filter(row => row.subjectBalanceDirection === '借');
      const creditList = subjectBalancePeriodList.filter(row => row.subjectBalanceDirection === '贷');
      periodStartDebit = _.sumBy(debitList, 'startDebit').toFixed(2);
      periodStartCredit = _.sumBy(creditList, 'startCredit').toFixed(2);
      periodStartAmount = (periodStartDebit - periodStartCredit).toFixed(2);
    }

    // 3. 资产负债表 试算平衡
    const { assetList, liabilityList } = await this.ctx.service.report.getItemListOfAssetLiability({ periodId });
    const assetTotalItem = assetList[assetList.length - 1];
    const liabilityTotalItem = liabilityList[liabilityList.length - 1];
    assetTotal = assetTotalItem?.itemEndAmountPeriod || 0;
    liabilityTotal = liabilityTotalItem?.itemEndAmountPeriod || 0;
    assetLiabilityTotalDiff = (assetTotal - liabilityTotal).toFixed(2);;

    // 4: 结账凭证校验证
    if (isCheckCheckoutVoucher === true) {
      const { rows: templateList } = await this.getCheckoutVoucherList({ periodId });
      const voucherListOfOldCheckout = await jianghuKnex(tableEnum.voucher, this.ctx)
        .where({ voucherType: "结账凭证", periodId }).select();
      templateList.forEach(template => {
        const { voucherTemplateId, voucherTemplateName, voucherType, voucherNew, voucherOld } = template;
        // Tip: 只 check 结账凭证
        if (voucherType !== "结账凭证") {
          return;
        }
        if (voucherNew.voucherEntryList.length === 0 && voucherOld.voucherEntryList.length > 0) {
          errorVoucherListOfCheckout.push({ voucherTemplateId, voucherTemplateName, errorMessage: `请手动删除 多余的 结账凭证(${voucherOld.voucher.voucherId})` })
        }
        if (voucherNew.voucherEntryList.length > 0 && voucherOld.voucherEntryList.length === 0) {
          errorVoucherListOfCheckout.push({ voucherTemplateId, voucherTemplateName, errorMessage: `请生成 ${voucherTemplateName} 结账凭证` })
        }
        if (voucherNew.voucherEntryList.length > 0 && voucherOld.voucherEntryList.length > 0) {
          if (voucherNew.debitSum != voucherOld.debitSum || voucherNew.creditSum != voucherOld.creditSum) {
            errorVoucherListOfCheckout.push({ voucherTemplateId, voucherTemplateName, errorMessage: `本期借贷有变动, 请重新生成 ${voucherTemplateName}结账凭证` })
          }
        }
      });
      voucherListOfOldCheckout.forEach(voucherOld => {
        const { voucherId } = voucherOld;
        if (templateList.findIndex(t => voucherId === t.voucherOld.voucher.voucherId) === -1) {
          errorVoucherListOfCheckout.push({ errorMessage: `请手动删除 多余的 结账凭证(${voucherOld.voucher.voucherId})` })
        }
      });

    }

    if (occurAmount != 0 || occurAmountYear != 0 || periodStartAmount != 0 || assetLiabilityTotalDiff != 0 ||
      errorVoucherListOfCheckout.length > 0) {
      isBalance = false;
    }

    return {
      isBalance,
      occurDebit, occurCredit, occurAmount,
      occurDebitYear, occurCreditYear, occurAmountYear,
      periodStartDebit, periodStartCredit, periodStartAmount,
      assetTotal, liabilityTotal, assetLiabilityTotalDiff,
      errorVoucherListOfCheckout
    };
  }

  async computeSubjectBalanceYearAdjust({ financeYear }) {
    const { jianghuKnex } = this.app;

    const subjectList = await jianghuKnex(tableEnum.subject, this.ctx).select();
    const voucherEntryListLastYear = await jianghuKnex(tableEnum.view01_voucher_entry, this.ctx)
      .where({ financeYear, voucherName: '去年' })
      .select();
    const voucherEntryListGroup = _.groupBy(voucherEntryListLastYear, 'subjectId');

    const subjectBalanceYearAdjustList = [];
    for (const subjectId in voucherEntryListGroup) {
      const voucherEntryList = voucherEntryListGroup[subjectId];
      const subject = subjectList.find(s => s.subjectId === subjectId);
      const { subjectBalanceDirection } = subject;
      const debitSum = _.sumBy(voucherEntryList, 'debit');
      const creditSum = _.sumBy(voucherEntryList, 'credit');
      subjectBalanceYearAdjustList.push({
        subjectId, financeYear,
        startDebitYearAdjust: subjectBalanceDirection === '借' ? debitSum - creditSum : 0,
        startCreditYearAdjust: subjectBalanceDirection === '贷' ? creditSum - debitSum : 0,
      })
    }

    await jianghuKnex.transaction(async trx => {
      await trx(tableEnum.subject_balance_year_adjust, this.ctx).where({ financeYear }).delete();
      if (subjectBalanceYearAdjustList.length > 0) {
        await trx(tableEnum.subject_balance_year_adjust, this.ctx).insert(subjectBalanceYearAdjustList);
      }
    });
  }

  async computeSubjectBalancePeriod({ periodId, updateToDB = true, voucherEntryList = null }) {
    const { jianghuKnex } = this.app;

    // 1. 当前会计期间 数据准备(凭证列表 和 科目余额)
    const period = await jianghuKnex(tableEnum.period, this.ctx).where({ periodId }).select().first();
    if (!period) {
      throw new BizError(errorInfoEnum.period_not_exist);
    }
    if (!voucherEntryList) {
      voucherEntryList = await jianghuKnex(tableEnum.view01_voucher_entry, this.ctx).where({ periodId }).select();
    }
    const subjectList = await jianghuKnex(tableEnum.subject, this.ctx).select();
    let subjectBalancePeriodList = await jianghuKnex(tableEnum.view01_subject_balance_period, this.ctx).where({ periodId }).select();


    // 容错处理 TODO: 优化比对           
    if (subjectList.length !== subjectBalancePeriodList.length) {
      const subjectBalancePeriodListTemp = subjectList.map(subject => ({
        id: subjectBalancePeriodList.find(item => item.subjectId === subject.subjectId)?.id || null,
        periodId: period.periodId, financeYear: period.financeYear,
        subjectId: subject.subjectId,
        isPeriodStart: period.isPeriodStart,
      }));

      // 删除当前会计期间所有科目余额数据，然后重新创建，科目在旧数据存在时，使用原来的科目ID
      await jianghuKnex.transaction(async trx => {
        await trx(tableEnum.subject_balance_period, this.ctx).where({ periodId }).delete();
        await trx(tableEnum.subject_balance_period, this.ctx).insert(subjectBalancePeriodListTemp);
      });

      subjectBalancePeriodList = await jianghuKnex(tableEnum.view01_subject_balance_period, this.ctx).where({ periodId }).select();
    }

    // 2. 上一个会计期间 数据准备(科目余额)
    let preSubjectBalanceMap = {};
    const prePeriod = await jianghuKnex(tableEnum.period, this.ctx)
      .whereRaw('periodId < ?', [periodId])
      .orderBy('periodId', 'desc')
      .select()
      .first();
    if (prePeriod) {
      const preSubjectBalanceList = await jianghuKnex(tableEnum.view01_subject_balance_period, this.ctx)
        .where({ periodId: prePeriod.periodId })
        .select();
      preSubjectBalanceMap = Object.fromEntries(
        preSubjectBalanceList.map(obj => [obj.subjectId, obj])
      );
    }

    // 3. 计算 新的科目余额(无下级科目)
    const newSubjectBalanceList = subjectBalancePeriodList.map(item => {
      const subjectBalance = { ...item };
      if (subjectBalance.subjectHasChildren !== '无下级科目') {
        return subjectBalance;
      }
      // if (debug && subjectBalance.subjectId === '3103') {
      //   console.log('diffSubjectBalanceList');
      // }
      const sbVoucherEntryList = voucherEntryList.filter(v => v.subjectId === subjectBalance.subjectId);
      const sbVoucherEntryListOfNoCheckout = voucherEntryList
        .filter(v => v.subjectId === subjectBalance.subjectId)
        .filter(v => v.voucherTemplateName !== '结转损益-本期')
        // .filter(v => v.voucherTemplateName !== '结转损益-以前年度')
        ;
      subjectBalance.occurDebit = _.sumBy(sbVoucherEntryList, 'debit');
      subjectBalance.occurCredit = _.sumBy(sbVoucherEntryList, 'credit');
      const preSubjectBalance = preSubjectBalanceMap[subjectBalance.subjectId];
      if (preSubjectBalance) {
        subjectBalance.startDebit = preSubjectBalance.endDebit;
        subjectBalance.startCredit = preSubjectBalance.endCredit;
      }
      if (subjectBalance.subjectBalanceDirection === '借') {
        subjectBalance.occurAmount = subjectBalance.occurDebit - subjectBalance.occurCredit;
        subjectBalance.endDebit = subjectBalance.startDebit + subjectBalance.occurAmount;
        subjectBalance.endCredit = 0;
      }
      if (subjectBalance.subjectBalanceDirection === '贷') {
        subjectBalance.occurAmount = subjectBalance.occurCredit - subjectBalance.occurDebit;
        subjectBalance.endDebit = 0;
        subjectBalance.endCredit = subjectBalance.startCredit + subjectBalance.occurAmount;
      }
      // Tip: 损益类科目特殊处理
      if (subjectBalance.subjectCategory === '损益') {
        const occurDebitOfNoCheckout = _.sumBy(sbVoucherEntryListOfNoCheckout, 'debit');
        const occurCreditOfNoCheckout = _.sumBy(sbVoucherEntryListOfNoCheckout, 'credit');
        subjectBalance.occurAmount = subjectBalance.subjectBalanceDirection === '借' ? occurDebitOfNoCheckout - occurCreditOfNoCheckout : occurCreditOfNoCheckout - occurDebitOfNoCheckout
      }
      return subjectBalance;
    });
    // 4. 计算 新的科目余额(有下级科目); 
    newSubjectBalanceList.forEach(subjectBalance => {
      if (subjectBalance.subjectHasChildren !== '有下级科目') {
        return
      }
      const { subjectId } = subjectBalance;
      const childrenSubjectBalanceList = newSubjectBalanceList
        .filter(item => item.subjectHasChildren === '无下级科目' && item.subjectId.startsWith(subjectId));
      subjectBalance.occurDebit = _.sumBy(childrenSubjectBalanceList, 'occurDebit');
      subjectBalance.occurCredit = _.sumBy(childrenSubjectBalanceList, 'occurCredit');
      // Tip: 累加计算==> 适配实际损益发生额
      subjectBalance.occurAmount = childrenSubjectBalanceList.reduce((sum, childrenSubjectBalance) => {
        return sum + (subjectBalance.subjectBalanceDirection === childrenSubjectBalance.subjectBalanceDirection ? childrenSubjectBalance.occurAmount : -childrenSubjectBalance.occurAmount);
      }, 0);
      if (subjectBalance.subjectBalanceDirection === '借') {
        subjectBalance.startCredit = 0;
        subjectBalance.endCredit = 0;
        subjectBalance.startDebit = childrenSubjectBalanceList.reduce((sum, childrenSubjectBalance) => {
          return sum + (subjectBalance.subjectBalanceDirection === childrenSubjectBalance.subjectBalanceDirection ? childrenSubjectBalance.startDebit : -childrenSubjectBalance.startCredit);
        }, 0);
        subjectBalance.endDebit = subjectBalance.startDebit + subjectBalance.occurAmount;
        if (subjectBalance.subjectCategory === '损益') {
          subjectBalance.endDebit = subjectBalance.startDebit + (subjectBalance.occurDebit - subjectBalance.occurCredit);
        }
      }
      if (subjectBalance.subjectBalanceDirection === '贷') {
        subjectBalance.startDebit = 0;
        subjectBalance.endDebit = 0;
        subjectBalance.startCredit = childrenSubjectBalanceList.reduce((sum, childrenSubjectBalance) => {
          return sum + (subjectBalance.subjectBalanceDirection === childrenSubjectBalance.subjectBalanceDirection ? childrenSubjectBalance.startCredit : -childrenSubjectBalance.startDebit);
        }, 0);
        subjectBalance.endCredit = subjectBalance.startCredit + subjectBalance.occurAmount;
        if (subjectBalance.subjectCategory === '损益') {
          subjectBalance.endCredit = subjectBalance.startCredit + (subjectBalance.occurCredit - subjectBalance.occurDebit);
        }
      }
    })

    // 5. 批量更新 新的科目余额到 数据库
    if (updateToDB) {
      await jianghuKnex.transaction(async (trx, trxKnex) => {
        await trx(tableEnum.subject_balance_period, this.ctx).where({ periodId }).delete();
        await trx(tableEnum.subject_balance_period, this.ctx).insert(newSubjectBalanceList.map(subjectBalance => _.pick(subjectBalance, [
          'id', 'periodId', 'financeYear', 'subjectId', 'startDebit', 'startCredit',
          'occurDebit', 'occurCredit', 'occurAmount', 'endDebit', 'endCredit', 'isPeriodStart'
        ])));
      });
    }

    return { rows: newSubjectBalanceList }
  }

  async computeSubjectBalanceYear({ financeYear, updateToDB = true, subjectBalancePeriodListOfYear = null }) {
    const ctx = this.ctx;
    const { jianghuKnex, logger } = this.app;

    // 1. 数据准备
    //  - 该年 所有会计期间   科目余额列表(期间)
    //  - 该年 第一个会计期间  科目余额列表(期间)
    //  - 该年              科目余额列表(年)
    const firstPeriod = await jianghuKnex(tableEnum.period, this.ctx)
      .where({ financeYear })
      .orderBy('periodId', 'asc')
      .select()
      .first();
    if (!subjectBalancePeriodListOfYear) {
      subjectBalancePeriodListOfYear = await jianghuKnex(tableEnum.view01_subject_balance_period, this.ctx)
        .where({ financeYear })
        .select();
    }
    let subjectBalanceFistPeriodList = subjectBalancePeriodListOfYear.filter(sbp => sbp.periodId === firstPeriod.periodId);
    let subjectBalanceYearList = await jianghuKnex(tableEnum.view01_subject_balance_year, this.ctx).where({ financeYear }).select();
    const subjectList = await jianghuKnex(tableEnum.subject, this.ctx).select();
    // 容错处理; TODO: 优化比对      
    if (subjectList.length !== subjectBalanceYearList.length) {
      const subjectBalanceYearListTemp = subjectList.map(subject => ({ financeYear, subjectId: subject.subjectId }));
      await jianghuKnex.transaction(async trx => {
        await trx(tableEnum.subject_balance_year, this.ctx).where({ financeYear }).delete();
        await trx(tableEnum.subject_balance_year, this.ctx).insert(subjectBalanceYearListTemp);
      });
      subjectBalanceYearList = await jianghuKnex(tableEnum.view01_subject_balance_year, this.ctx).where({ financeYear }).select();
    }
    const isYearStart = firstPeriod.isPeriodStart == '是';
    const subjectBalanceStartList = await jianghuKnex(tableEnum.subject_balance_start, this.ctx).select();
    const subjectBalanceStartMap = Object.fromEntries(
      subjectBalanceStartList.map(obj => [obj.subjectId, obj])
    );



    // 2. 数据准备 科目余额列表(年)
    //   - 年发生额
    //   - 年初额
    //   - 是否有下级科目
    const yearDataMap = {};
    const subjectIdGroupList = _.groupBy(subjectBalancePeriodListOfYear, 'subjectId');
    for (let subjectId in subjectIdGroupList) {
      const list = subjectIdGroupList[subjectId];
      if (isYearStart) {
        const subjectBalanceStart = subjectBalanceStartMap[subjectId] || {};
        const occurDebitYear = _.sumBy(list, 'occurDebit') + (subjectBalanceStart.occurDebitYear || 0);
        const occurCreditYear = _.sumBy(list, 'occurCredit') + (subjectBalanceStart.occurCreditYear || 0);
        const occurAmountYear = _.sumBy(list, 'occurAmount') + (subjectBalanceStart.occurAmountYear || 0);
        yearDataMap[subjectId] = { occurDebitYear, occurCreditYear, occurAmountYear };
      }
      if (!isYearStart) {
        const occurDebitYear = _.sumBy(list, 'occurDebit');
        const occurCreditYear = _.sumBy(list, 'occurCredit');
        const occurAmountYear = _.sumBy(list, 'occurAmount');
        yearDataMap[subjectId] = { occurDebitYear, occurCreditYear, occurAmountYear };
      }
    }
    subjectBalanceFistPeriodList.forEach(sbFirstPeriod => {
      const yearData = yearDataMap[sbFirstPeriod.subjectId];
      // 年中启用账套: 从科目初始余额页面 取 年初余额
      if (isYearStart) {
        const subjectBalanceStart = subjectBalanceStartMap[sbFirstPeriod.subjectId] || {};
        yearData.startDebitYearNoAdjust = subjectBalanceStart.startDebitYear || 0;
        yearData.startCreditYearNoAdjust = subjectBalanceStart.startCreditYear || 0;
      } else {
        // 从本年第一个会计期间 取 年初余额
        yearData.startDebitYearNoAdjust = sbFirstPeriod.startDebit;
        yearData.startCreditYearNoAdjust = sbFirstPeriod.startCredit;
      }
    });

    // 3. 计算 新的科目余额-年; 
    const newSubjectBalanceYearList = subjectBalanceYearList.map(subjectBalanceYear => {
      const yearData = yearDataMap[subjectBalanceYear.subjectId];
      const { startDebitYearNoAdjust, startCreditYearNoAdjust, occurDebitYear, occurCreditYear, occurAmountYear } = yearData;
      let endDebitYear = 0, endCreditYear = 0;
      if (subjectBalanceYear.subjectBalanceDirection === '借') {
        endDebitYear = startDebitYearNoAdjust + occurAmountYear;
        endCreditYear = 0;
      }
      if (subjectBalanceYear.subjectBalanceDirection === '贷') {
        endCreditYear = startCreditYearNoAdjust + occurAmountYear;
        endDebitYear = 0;
      }
      if (subjectBalanceYear.subjectCategory === '损益') {
        endDebitYear = 0;
        endCreditYear = 0;
      }
      const newSubjectBalanceYear = {
        ...subjectBalanceYear,
        startDebitYearNoAdjust, startCreditYearNoAdjust,
        startDebitYear: startDebitYearNoAdjust + subjectBalanceYear.startDebitYearAdjust,
        startCreditYear: startCreditYearNoAdjust + subjectBalanceYear.startCreditYearAdjust,
        occurDebitYear, occurCreditYear, occurAmountYear,
        endDebitYear, endCreditYear,
      };

      // TODO: 年的损益额
      return newSubjectBalanceYear;
    })

    // 4. 更新 新的科目余额到数据库; 
    const diffSubjectBalanceYearList = newSubjectBalanceYearList.filter(newItem => {
      const item = subjectBalanceYearList.find(item => item.id === newItem.id);
      if (newItem.startDebitYearNoAdjust !== item.startDebitYearNoAdjust) { return true; }
      if (newItem.startCreditYearNoAdjust != item.startCreditYearNoAdjust) { return true; }
      if (newItem.startDebitYear !== item.startDebitYear) { return true; }
      if (newItem.startCreditYear != item.startCreditYear) { return true; }

      if (newItem.occurDebitYear !== item.occurDebitYear) { return true; }
      if (newItem.occurCreditYear != item.occurCreditYear) { return true; }
      if (newItem.occurAmountYear != item.occurAmountYear) { return true; }

      if (newItem.endDebitYear !== item.endDebitYear) { return true; }
      if (newItem.endCreditYear != item.endCreditYear) { return true; }
      return false;
    })
    if (diffSubjectBalanceYearList.length > 0 && updateToDB === true) {
      await jianghuKnex.transaction((trx, trxKnex) => {
        const queries = diffSubjectBalanceYearList.map(subjectBalanceYear =>
          trx(tableEnum.subject_balance_year, this.ctx)
            .where({ id: subjectBalanceYear.id })
            .update({
              startDebitYearNoAdjust: subjectBalanceYear.startDebitYearNoAdjust,
              startCreditYearNoAdjust: subjectBalanceYear.startCreditYearNoAdjust,
              startDebitYear: subjectBalanceYear.startDebitYear,
              startCreditYear: subjectBalanceYear.startCreditYear,

              occurDebitYear: subjectBalanceYear.occurDebitYear,
              occurCreditYear: subjectBalanceYear.occurCreditYear,
              occurAmountYear: subjectBalanceYear.occurAmountYear,

              endDebitYear: subjectBalanceYear.endDebitYear,
              endCreditYear: subjectBalanceYear.endCreditYear,
            })
            .transacting(trxKnex)
        );
        return Promise
          .all(queries)
          .then(trx.commit)
          .catch((err) => {
            logger.error("[computeSubjectBalanceYear] jianghuKnex.transaction error", err);
            // TODO: 报错了
            // trx.rollback();
          });
      });
    }

    return { rows: newSubjectBalanceYearList };
  }

  async computeSubjectBalance({ periodId, updateToDB = true, voucherEntryList = null }) {
    const { jianghuKnex } = this.app;
    const financeYear = dayjs(periodId).year();
    await this.computeSubjectBalanceYearAdjust({ financeYear });

    const { rows: subjectBalancePeriodList } = await this.computeSubjectBalancePeriod({ periodId, updateToDB, voucherEntryList });
    const subjectBalancePeriodListOfYear = await jianghuKnex(tableEnum.view01_subject_balance_period, this.ctx)
      .where({ financeYear })
      .whereRaw('periodId < ?', [periodId])
      .select();
    subjectBalancePeriodListOfYear.push(...subjectBalancePeriodList);
    const { rows: subjectBalanceYearList } = await this.computeSubjectBalanceYear({ financeYear, updateToDB, subjectBalancePeriodListOfYear });

    const subjectBalanceYearMap = Object.fromEntries(subjectBalanceYearList.map(obj => [obj.subjectId, obj]));
    const subjectBalanceList = subjectBalancePeriodList.map(subjectBalancePeriod => {
      const subjectBalanceYear = subjectBalanceYearMap[subjectBalancePeriod.subjectId] || {};
      return { ...subjectBalancePeriod, ..._.pick(subjectBalanceYear, ['startDebitYear', 'startCreditYear', 'occurDebitYear', 'occurCreditYear', 'occurAmountYear', 'endDebitYear', 'endCreditYear']) }
    })
    return { subjectBalancePeriodList, subjectBalanceYearList, subjectBalanceList };
  }

  /**
   * 使用实时生成的结账凭证 计算科目余额(不写到数据库)
   */
  async computeSubjectBalanceOfNewCheckoutVoucherList({ periodId }) {
    const { jianghuKnex } = this.app
    const voucherEntryListOld = await jianghuKnex(tableEnum.view01_voucher_entry, this.ctx).where({ periodId }).select();
    const voucherEntryListNew = voucherEntryListOld
      .filter(v => v.voucherType != '结账凭证');
    const { rows: templateList } = await this.getCheckoutVoucherList({ periodId });
    templateList.forEach(template => {
      const { voucherNew } = template;
      const { voucher } = voucherNew;
      const voucherEntryListTemp = voucherNew.voucherEntryList.map(ve => { return { ...ve, ...voucher } });
      voucherEntryListNew.push(...voucherEntryListTemp)
    })
    const { subjectBalanceList } = await this.computeSubjectBalance({ periodId, updateToDB: false, voucherEntryList: voucherEntryListNew });
    return { subjectBalanceList };
  }

  async reCheckoutAllPeriod({ checkBalanceNeed = true }) {
    const { jianghuKnex } = this.app;
    const periodList = await jianghuKnex(tableEnum.period, this.ctx)
      .orderBy('periodId', 'asc')
      .select();
    if (periodList.length === 0) {
      return;
    }
    await jianghuKnex(tableEnum.period, this.ctx).update({ isCheckout: '重新结账中' });
    for (let i = 0; i < periodList.length - 1; i++) {
      await this.checkout({
        currentPeriodId: periodList[i].periodId,
        nextPeriodId: periodList[i + 1].periodId,
        checkBalanceNeed,
      });
    }
  }

  async getCheckoutVoucherList({ periodId }) {
    const { jianghuKnex } = this.app;
    const currentPeriod = await jianghuKnex(tableEnum.period, this.ctx).where({ periodId }).select().first();
    if (!currentPeriod) {
      throw new BizError(errorInfoEnum.period_not_exist);
    }
    const templateList = await jianghuKnex(tableEnum.voucher_template, this.ctx)
      .where({ voucherType: '结账凭证' })
      .orderBy('sort', 'asc') // 结转损益-本期 要在最后执行
      .select();
    const voucherTemplateId = templateList.map(t => t.voucherTemplateId);

    // 1. 老的模版 凭证
    const voucherOldList = [];
    const templateVoucherEntryList = await jianghuKnex(tableEnum.view01_voucher_entry, this.ctx)
      .where({ periodId })
      .whereIn('voucherTemplateId', voucherTemplateId)
      .select();
    const templateVoucherGroup = _.groupBy(templateVoucherEntryList, 'voucherId');
    for (const voucherId in templateVoucherGroup) {
      const entryList = templateVoucherGroup[voucherId];
      const entry = entryList[0];
      const { voucherName, voucherNumber, voucherAt, voucherType, voucherTemplateId, voucherTemplateName } = entry;
      voucherOldList.push({
        voucher: { periodId, voucherId, voucherName, voucherNumber, voucherAt, voucherTemplateId, voucherTemplateName, voucherType },
        voucherEntryList: entryList,
        debitSum: _.sumBy(entryList, 'debit').toFixed(2),
        creditSum: _.sumBy(entryList, 'credit').toFixed(2),
      })
    }

    // 2. 过滤掉已生成的 结账凭证 ===> 然后实时计算 一个科目余额列表
    let allVoucherEntryList = await jianghuKnex(tableEnum.view01_voucher_entry, this.ctx)
      .where({ periodId }).select();
    allVoucherEntryList = allVoucherEntryList.filter(v => v.voucherType !== '结账凭证');
    const { rows: subjectBalancePeriodList } = await this.computeSubjectBalancePeriod({ periodId, updateToDB: false, voucherEntryList: allVoucherEntryList });


    // 3. 新的 模版凭证
    const voucherAt = dayjs(periodId).endOf('month').format('YYYY-MM-DD');
    const voucherNumberTemp = await (await this.service.voucher.selectNextVoucherNumber({ periodId })).voucherNumber;
    for (let i = 0; i < templateList.length; i++) {

      const template = templateList[i];
      const { voucherTemplateId, voucherTemplateName, voucherType } = template;
      const voucherTemplateConfig = JSON.parse(template.voucherTemplateConfig)
      const voucherNew = { voucher: null, voucherEntryList: [], debitSum: 0, creditSum: 0 };
      const voucherNumber = voucherNumberTemp + i;

      if (template.voucherTemplateName === "计提地税") {
        const { voucherName, computeSubjectId, voucherEntryList: templateVoucherEntryList } = voucherTemplateConfig;
        const voucherId = `${periodId}-${voucherName}-${voucherNumber}`;
        const computeSubjectBalancePeriod = subjectBalancePeriodList.find(sbp => sbp.subjectId === computeSubjectId)
        const { debitSum, creditSum, amountSum, voucherEntryList } = await this.computeVoucherEntryListOfDishui({ templateVoucherEntryList, computeSubjectBalancePeriod, voucherId });
        voucherNew.voucher = { periodId, voucherId, voucherName, voucherNumber, voucherAt, voucherTemplateId, voucherTemplateName, voucherType };
        voucherNew.voucherEntryList = voucherEntryList;
        voucherNew.debitSum = debitSum;
        voucherNew.creditSum = creditSum;
        voucherNew.amountSum = amountSum;
        allVoucherEntryList.push(...voucherEntryList);
      } else if (template.voucherTemplateName === "结转损益-本期") {
        const { voucherName, carrySubjectId, entryAbstract } = voucherTemplateConfig;
        const voucherId = `${periodId}-${voucherName}-${voucherNumber}`;
        // Tip: 计提地税的凭证 损益科目余额, 所以要重用allVoucherEntryList计算
        const voucherEntryListSunYi = allVoucherEntryList.filter(voucherEntry => voucherEntry.subjectId.startsWith('5'));
        const voucherEntryGroupSunYi = _.groupBy(voucherEntryListSunYi, (item) => `${item.subjectId}_${item.assistIdOfCustomer || ''}_${item.assistIdOfSupplier || ''}_${item.assistIdOfStaff || ''}_${item.assistIdOfProject || ''}_${item.assistIdOfDepart || ''}`);
        const newSubjectBalancePeriodList = [];
        for (const assistKey in voucherEntryGroupSunYi) {
          const assistEntryList = voucherEntryGroupSunYi[assistKey];
          const { subjectBalanceDirection, subjectId } = assistEntryList[0]
          const assistInfo = getAssistInfoFromVoucherEntry(assistEntryList[0]);
          const debitSum = _.sumBy(assistEntryList, 'debit');
          const creditSum = _.sumBy(assistEntryList, 'credit');
          newSubjectBalancePeriodList.push({
            occurAmount: subjectBalanceDirection == '借' ? Math.round((debitSum - creditSum) * 100) / 100 : Math.round((creditSum - debitSum) * 100) / 100,
            subjectBalanceDirection,
            subjectId,
            ...assistInfo,
          })
        }
        const { debitSum, creditSum, amountSum, voucherEntryList } = await this.computeVoucherEntryListOfJieZhuan({ entryAbstract, carrySubjectId, voucherId, subjectBalancePeriodList: newSubjectBalancePeriodList });
        voucherNew.voucher = { periodId, voucherId, voucherName, voucherNumber, voucherAt, voucherTemplateId, voucherTemplateName, voucherType };
        voucherNew.voucherEntryList = voucherEntryList;
        voucherNew.debitSum = debitSum;
        voucherNew.creditSum = creditSum;
        voucherNew.amountSum = amountSum;
      } else {
        throw new BizError(errorInfoEnum.data_exception);
      }
      template.voucherOld = voucherOldList.find(v => v.voucher.voucherTemplateId === voucherTemplateId) || { voucher: {}, voucherEntryList: [] };
      template.voucherNew = voucherNew;
    }

    return { rows: templateList };
  }

  async generateCheckoutVoucherList({ periodId }) {
    const { jianghuKnex } = this.app
    const currentPeriod = await jianghuKnex(tableEnum.period, this.ctx).where({ periodId }).select().first();
    if (!currentPeriod) {
      throw new BizError(errorInfoEnum.period_not_exist);
    }
    if (currentPeriod.isCheckout !== '待结账') {
      throw new BizError(errorInfoEnum.period_has_checkout);
    }

    // 删除老的结账凭证
    const oldCheckoutVoucherList = await jianghuKnex(tableEnum.voucher, this.ctx)
      .where({ voucherType: "结账凭证", periodId })
      .select('voucherId');
    const oldCheckoutVoucherIdList = oldCheckoutVoucherList.map(v => v.voucherId);
    await jianghuKnex.transaction(async trx => {
      if (oldCheckoutVoucherIdList.length > 0) {
        await trx(tableEnum.voucher, this.ctx).whereIn('voucherId', oldCheckoutVoucherIdList).delete();
        await trx(tableEnum.voucher_entry, this.ctx).whereIn('voucherId', oldCheckoutVoucherIdList).delete();
      }
    })

    // 获取最新的结账凭证
    const { rows: templateList } = await this.getCheckoutVoucherList({ periodId });

    // 更新新的模版凭证 到数据库
    await jianghuKnex.transaction(async trx => {
      for (let template of templateList) {
        const { voucherNew } = template;
        const { voucher, voucherEntryList } = voucherNew;
        voucherEntryList.forEach(ve => { delete ve.subjectBalanceDirection; })
        if (voucherEntryList.length > 0) {
          await trx(tableEnum.voucher, this.ctx).insert(voucher);
          await trx(tableEnum.voucher_entry, this.ctx).insert(voucherEntryList);
        }
      }
    })

    // 4. 重新计算下科目余额
    await this.ctx.service.period.computeSubjectBalancePeriod({ periodId });

    return { rows: templateList };
  }

  async deleteCheckoutVoucher({ periodId }) {
    const { jianghuKnex } = this.app
    const currentPeriod = await jianghuKnex(tableEnum.period, this.ctx).where({ periodId }).select().first();
    if (!currentPeriod) {
      throw new BizError(errorInfoEnum.period_not_exist);
    }
    if (currentPeriod.isCheckout !== '待结账') {
      throw new BizError(errorInfoEnum.period_has_checkout);
    }

    const oldCheckoutVoucherList = await jianghuKnex(tableEnum.voucher, this.ctx)
      .where({ voucherType: "结账凭证", periodId })
      .select('voucherId');
    const oldCheckoutVoucherIdList = oldCheckoutVoucherList.map(v => v.voucherId);
    await jianghuKnex.transaction(async trx => {
      if (oldCheckoutVoucherIdList.length > 0) {
        await trx(tableEnum.voucher, this.ctx).whereIn('voucherId', oldCheckoutVoucherIdList).delete();
        await trx(tableEnum.voucher_entry, this.ctx).whereIn('voucherId', oldCheckoutVoucherIdList).delete();
      }
    })

    await this.computeSubjectBalance({ periodId });
  }

  /**
   * 计算 计提地税 voucherEntryList
   */
  async computeVoucherEntryListOfDishui({ templateVoucherEntryList, computeSubjectBalancePeriod, voucherId }) {
    if (!computeSubjectBalancePeriod || computeSubjectBalancePeriod.occurAmount <= 0) {
      return { voucherEntryList: [] };
    }
    const voucherEntryList = templateVoucherEntryList.map(v => {
      const { subjectBalanceDirection = '借', moneyRatio = 0, subjectId, entryAbstract } = v;
      return {
        subjectId, entryAbstract, voucherId, subjectBalanceDirection,
        debit: subjectBalanceDirection === '借' ? Math.round(computeSubjectBalancePeriod.occurAmount * moneyRatio) / 100 : 0,
        credit: subjectBalanceDirection === '借' ? 0 : Math.round(computeSubjectBalancePeriod.occurAmount * moneyRatio) / 100,
      }
    });
    const debitSum = _.sumBy(voucherEntryList, 'debit').toFixed(2);
    const creditSum = _.sumBy(voucherEntryList, 'credit').toFixed(2);
    return {
      debitSum: debitSum,
      creditSum: creditSum,
      amountSum: debitSum,
      voucherEntryList,
    }
  }

  /**
   * 计算 结转利润-本期 voucherEntryList
   */
  async computeVoucherEntryListOfJieZhuan({ entryAbstract, carrySubjectId, subjectBalancePeriodList, voucherId }) {
    const profitLossSBListDebit = subjectBalancePeriodList
      .filter(subject => subject.subjectBalanceDirection == '借')
      .filter(subject => subject.occurAmount != 0);
    const profitLossSBListCredit = subjectBalancePeriodList
      .filter(subject => subject.subjectBalanceDirection == '贷')
      .filter(subject => subject.occurAmount != 0);

    const debit = Math.round(_.sumBy(profitLossSBListDebit, 'occurAmount') * 100) / 100;
    const credit = Math.round(_.sumBy(profitLossSBListCredit, 'occurAmount') * 100) / 100;
    const entryListOfDebit = profitLossSBListDebit.map(subjectBalance => {
      const { subjectBalanceDirection } = subjectBalance;
      const subjectAllAssist = this.ctx.service.subject.getSubjectAssist(subjectBalance);
      return {
        entryAbstract: null,
        subjectId: subjectBalance.subjectId, subjectBalanceDirection,
        debit: 0,
        credit: subjectBalance.occurAmount,
        ...subjectAllAssist
      }
    });
    const entryListOfCredit = profitLossSBListCredit.map(subjectBalance => {
      const { subjectBalanceDirection } = subjectBalance;
      const subjectAllAssist = this.ctx.service.subject.getSubjectAssist(subjectBalance);
      return {
        entryAbstract: null,
        subjectId: subjectBalance.subjectId, subjectBalanceDirection,
        debit: subjectBalance.occurAmount,
        credit: 0,
        ...subjectAllAssist
      }
    });
    const voucherEntryList = [
      ...entryListOfDebit,
      ...entryListOfCredit,
    ]
    if (debit !== 0) {
      const profitGroup = _.groupBy(profitLossSBListDebit, (item) => {
        return `${item.assistIdOfCustomer || ''}_${item.assistIdOfSupplier || ''}_${item.assistIdOfStaff || ''}_${item.assistIdOfProject || ''}_${item.assistIdOfDepart || ''}`
      });
      for (let key in profitGroup) {
        const profitList = profitGroup[key];
        const profit = Math.round(_.sumBy(profitList, 'occurAmount') * 100) / 100;
        const { subjectBalanceDirection } = profitList[0];
        const subjectAllAssist = this.ctx.service.subject.getSubjectAssist(profitList[0]);
        if (profit != 0) {
          voucherEntryList.unshift({
            subjectId: carrySubjectId, subjectBalanceDirection,
            entryAbstract: `${entryAbstract}`,
            debit: profit,
            credit: 0,
            ...subjectAllAssist
          })
        }
      }
    }
    if (credit !== 0) {
      const lossGroup = _.groupBy(profitLossSBListCredit, (item) => {
        return `${item.assistIdOfCustomer || ''}_${item.assistIdOfSupplier || ''}_${item.assistIdOfStaff || ''}_${item.assistIdOfProject || ''}_${item.assistIdOfDepart || ''}`
      });
      for (let key in lossGroup) {
        const lossList = lossGroup[key];
        const loss = Math.round(_.sumBy(lossList, 'occurAmount') * 100) / 100;
        const { subjectBalanceDirection } = lossList[0];
        const subjectAllAssist = this.ctx.service.subject.getSubjectAssist(lossList[0]);
        if (loss != 0) {
          voucherEntryList.unshift({
            subjectId: carrySubjectId, subjectBalanceDirection,
            entryAbstract: `${entryAbstract}`,
            debit: 0,
            credit: loss,
            ...subjectAllAssist
          })
        }
      }
    }
    voucherEntryList.forEach(ve => { ve.voucherId = voucherId; })
    return {
      debitSum: (credit + debit).toFixed(2),
      creditSum: (credit + debit).toFixed(2),
      amountSum: (credit - debit).toFixed(2),
      voucherEntryList,
    }
  }


  async getAdditionDishuiVoucher({ periodId }) {
    const { jianghuKnex } = this.app
    const dishuiVoucher = await jianghuKnex(tableEnum.voucher, this.ctx).where({ voucherTemplateName: '计提地税', periodId }).first();
    const additionDishuiVoucher = { voucher: null, voucherEntryList: [] };
    if (dishuiVoucher) {
      return additionDishuiVoucher
    }

    const template = await jianghuKnex(tableEnum.voucher_template, this.ctx).where({ voucherTemplateName: '计提地税' }).first();
    const { voucherTemplateId, voucherTemplateName, voucherType } = template;
    const voucherTemplateConfig = JSON.parse(template.voucherTemplateConfig)
    const { voucherName, computeSubjectId, voucherEntryList: templateVoucherEntryList } = voucherTemplateConfig;

    const computeSubjectBalancePeriod = await jianghuKnex(tableEnum.subject_balance_period, this.ctx).where({ periodId, subjectId: computeSubjectId }).first();
    const { debitSum, creditSum, amountSum, voucherEntryList } = await this.computeVoucherEntryListOfDishui({ templateVoucherEntryList, computeSubjectBalancePeriod });
    const voucherNumber = await (await this.service.voucher.selectNextVoucherNumber({ periodId })).voucherNumber;
    const voucherAt = dayjs(periodId).endOf('month').format('YYYY-MM-DD');
    const voucherId = `${periodId}-${voucherName}-${voucherNumber}`;
    voucherEntryList.forEach(v => { v.voucherId = voucherId; delete v.subjectBalanceDirection; });
    additionDishuiVoucher.voucherEntryList = voucherEntryList;
    additionDishuiVoucher.voucher = {
      voucherId, voucherName, voucherNumber, voucherAt,
      periodId, voucherTemplateId, voucherTemplateName, voucherType,
    };
    additionDishuiVoucher.amountSum = amountSum;
    return additionDishuiVoucher;
  }

  // 结账检查
  async checkoutExamine(actionData) {
    const ctx = this.ctx;
    const { jianghuKnex } = this.app;
    validateUtil.validate(actionDataScheme.checkout, actionData);
    const { currentPeriodId, nextPeriodId } = actionData;
    const result = []

    const [subjectBalanceList, voucherList, ___, checkBalanceResult, { rows: generalLedgerList }, { assetList, liabilityList }, { rows: templateList }] = await Promise.all([
      jianghuKnex(tableEnum.view01_subject_balance_period, this.ctx).where({ periodId: currentPeriodId }).select(),
      jianghuKnex(tableEnum.voucher, this.ctx).where({ periodId: currentPeriodId }).select(),
      this.computeSubjectBalance({ periodId: currentPeriodId }),
      this.checkSubjectBalance({ periodId: currentPeriodId, isCheckCheckoutVoucher: true }),
      this.ctx.service.account.getItemListOfGeneralLedger({ periodIdList: [currentPeriodId] }),
      this.ctx.service.report.getItemListOfAssetLiability({ periodId: currentPeriodId }),
      this.getCheckoutVoucherList({ periodId: currentPeriodId })
    ]);

    // const subjectBalanceItem = await this._checkSubjectBalance({ subjectBalanceList });
    // result.push(subjectBalanceItem)

    const endCarryOverItem = await this._checkEndCarryOver({ subjectBalanceList, templateList, currentPeriodId });
    result.push(endCarryOverItem)

    const creditItem = await this._checkCredit({ subjectBalanceList });
    result.push(creditItem)

    const otherErrorItem = await this._checkOtherError({ checkBalanceResult ,subjectBalanceList ,generalLedgerList, subjectBalanceList, voucherList, assetList, liabilityList });
    result.push(otherErrorItem)

    return result
  }
  // 资产类科目余额--检查
  async _checkSubjectBalance({ subjectBalanceList }) {
    // 资产类科目余额--检查
    const subjectBalanceItem = {
      title: '资产类科目余额',
      subtitle: `此条目尚未检查`,
      items: [
        { title: '库存现金', linkText: '无赤字', link: '/jh-finance/page/account-subjectDetail?subjectId=1001' },
        { title: '银行存款', linkText: '无赤字', link: '/jh-finance/page/account-subjectDetail?subjectId=1002' },
        { title: '原 材 料', linkText: '无赤字', link: '/jh-finance/page/account-subjectDetail?subjectId=1403' },
        { title: '库存商品', linkText: '无赤字', link: '/jh-finance/page/account-subjectDetail?subjectId=1405' },
        { title: '固定资产', linkText: '固定资产-累计折旧>=0', link: '/jh-finance/page/account-subjectDetail?subjectId=1601' },
        { title: '无形资产', linkText: '无形资产-累计摊销>=0', link: '/jh-finance/page/account-subjectDetail?subjectId=1701' },
        { title: '长期待摊费用', linkText: '无赤字', link: '/jh-finance/page/account-subjectDetail?subjectId=1801' },
      ]
    }
    const subjectBalance1001 = subjectBalanceList.find(item => item.subjectId.startsWith('1001'))
    const subjectBalance1002 = subjectBalanceList.find(item => item.subjectId.startsWith('1002'))
    const subjectBalance1403 = subjectBalanceList.find(item => item.subjectId.startsWith('1403'))
    const subjectBalance1405 = subjectBalanceList.find(item => item.subjectId.startsWith('1405'))
    const subjectBalance1601 = subjectBalanceList.find(item => item.subjectId.startsWith('1601'))
    const subjectBalance1701 = subjectBalanceList.find(item => item.subjectId.startsWith('1701'))
    const subjectBalance1801 = subjectBalanceList.find(item => item.subjectId.startsWith('1801'))
    const subjectBalance1602 = subjectBalanceList.find(item => item.subjectId.startsWith('1602'))
    const subjectBalance1702 = subjectBalanceList.find(item => item.subjectId.startsWith('1702'))
    subjectBalanceItem.items.forEach((item, index) => {
      switch (index) {
        case 0:
          if (subjectBalance1001.occurAmount < 0) {
            item.linkText = `有赤字${subjectBalance1001.occurAmount}`
            item.status = 'error'
          }
          break;
        case 1:
          if (subjectBalance1002.occurAmount < 0) {
            item.linkText = `有赤字${subjectBalance1002.occurAmount}`
            item.status = 'error'
          }
          break;
        case 2:
          if (subjectBalance1403.occurAmount < 0) {
            item.linkText = `有赤字${subjectBalance1403.occurAmount}`
            item.status = 'error'
          }
          break;
        case 3:
          if (subjectBalance1405.occurAmount < 0) {
            item.linkText = `有赤字${subjectBalance1405.occurAmount}`
            item.status = 'error'
          }
          break;
        case 4:
          if (subjectBalance1601.occurAmount - subjectBalance1602.occurAmount < 0) {
            item.linkText += `,有赤字${subjectBalance1601.occurAmount}`
            item.status = 'error'
          }
          break;
        case 5:
          if (subjectBalance1701.occurAmount - subjectBalance1702.occurAmount < 0) {
            item.linkText += `,有赤字${subjectBalance1701.occurAmount}`
            item.status = 'error'
          }
          break;
        case 6:
          if (subjectBalance1801.occurAmount < 0) {
            item.linkText = `有赤字${subjectBalance1801.occurAmount}`
            item.status = 'error'
          }
          break;
        default:
          break;
      }
    })
    subjectBalanceItem.subtitle = `共有${subjectBalanceItem.items.length}项类目，其中${subjectBalanceItem.items.filter(item => item.status == 'error').length}项类目有风险`

    return subjectBalanceItem
  }

  // 资产负债表--检查
  async _checkEndCarryOver({ subjectBalanceList, templateList, currentPeriodId  }) {
    // 期末结转--检查
    const endCarryOverItem = {
      title: '期末结转',
      subtitle: `此条目尚未检查`,
      items: templateList.map(item=> ({
        title: item.voucherTemplateName,
        linkText: '已自动生成结账凭证',
        link: '',
      }))
    }
    await this.generateCheckoutVoucherList({ periodId: currentPeriodId })
  
    endCarryOverItem.subtitle = `共有${endCarryOverItem.items.length}项类目，其中${endCarryOverItem.items.filter(item => item.status == 'error').length}项类目有风险`
    return endCarryOverItem
  }

  // 检查账款
  async _checkCredit({  }) {
    // ---------------------------------------------------------

    // 往来挂账超过一年--检查
    const creditItem = {
      title: '往来挂账超过一年',
      subtitle: `此条目尚未检查`,
      items: [
        { title: '应付账款', linkText: '未超过', link: '/jh-finance/page/account-subjectDetail?subjectId=2202' },
        { title: '预收账款', linkText: '未超过', link: '/jh-finance/page/account-subjectDetail?subjectId=2203' },
        { title: '预付账款', linkText: '未超过', link: '/jh-finance/page/account-subjectDetail?subjectId=1123' },
      ]
    }
    creditItem.items.forEach((item, index) => {
      switch (index) {
        case 0:
          break;
        case 1:
          break;
        case 2:
          break;
        default:
          break;
      }
      // TODO: 待计算
      item.linkText = '---'
    })

    creditItem.subtitle = `共有${creditItem.items.length}项类目，其中${creditItem.items.filter(item => item.status == 'error').length}项类目有风险`

    return creditItem
  }

  // 异常检查
  async _checkOtherError({ generalLedgerList, subjectBalanceList, voucherList, assetList, liabilityList, checkBalanceResult   }) {
    // 其他异常--检查
    const otherErrorItem = {
      title: '其他异常',
      subtitle: `此条目尚未检查`,
      items: [
        { title: '初始余额', linkText: '试算平衡', link: '/jh-finance/page/setting-subjectBalanceStart' },
        { title: '本年累计', linkText: '试算平衡', link: '/jh-finance/page/setting-subjectBalanceStart' },
        // 【固定资产】与【总账】对账相符可能是指凭证计算的和总账计算的相符
        { title: '固定资产', linkText: '【固定资产】与【总账】对账相符', link: '/jh-finance/page/account-generalLedger' },
        { title: '无形资产', linkText: '【无形资产】与【总账】对账相符', link: '/jh-finance/page/account-generalLedger' },
        { title: '长期待摊费用', linkText: '【长期待摊费用】与【总账】对账相符', link: '/jh-finance/page/account-generalLedger' },
        { title: '资产负债表', linkText: '资产负债表平衡', link: '/jh-finance/page/account-subjectDetail?subjectId=1123' },
        { title: '断号', linkText: '无断号', link: '/jh-finance/page/voucher-voucherManagement' },
      ]
    }

    let currentGeneralLedger = {}
    let currentSubjectBalance = {}
    otherErrorItem.items.forEach((item, index) => {
      switch (index) {
        case 0:
          if (checkBalanceResult.periodStartCredit != checkBalanceResult.periodStartDebit) {
            item.linkText = `试算不平衡(${checkBalanceResult.periodStartAmount})`
            item.status = 'error'
          }
          break;
        case 1:
          if (checkBalanceResult.occurCreditYear != checkBalanceResult.occurDebitYear) {
            item.linkText = `试算不平衡`
            item.status = 'error'
          }
          break;
        case 2:
          currentGeneralLedger = generalLedgerList.filter(item => item.subjectId == 1601)
          currentSubjectBalance = subjectBalanceList.filter(item => item.subjectId == 1601)
          if (currentGeneralLedger.occurAmount != currentSubjectBalance.occurAmount) {
            item.linkText = `【固定资产】与【总账】对账不相符`
            item.status = 'error'
          }
          break;
        case 3:
          currentGeneralLedger = generalLedgerList.filter(item => item.subjectId == 1701)
          currentSubjectBalance = subjectBalanceList.filter(item => item.subjectId == 1701)
          if (currentGeneralLedger.occurAmount != currentSubjectBalance.occurAmount) {
            item.linkText = `【无形资产】与【总账】对账不相符`
            item.status = 'error'
          }
          break;
        case 4:
          currentGeneralLedger = generalLedgerList.filter(item => item.subjectId == 1801)
          currentSubjectBalance = subjectBalanceList.filter(item => item.subjectId == 1801)
          if (currentGeneralLedger.occurAmount != currentSubjectBalance.occurAmount) {
            item.linkText = `【固定资产】与【总账】对账不相符`
            item.status = 'error'
          }
          break;
        case 5:
          // Tip: 有bug先拿掉
          // 资产负债
          // const assetItem = assetList[assetList.length - 1]
          // const liabilityItem = liabilityList[liabilityList.length - 1]
          // if (assetItem.itemEndAmountPeriod != liabilityItem.itemEndAmountPeriod) {
          //   item.linkText = `资产负债表不平衡`
          //   item.status = 'error'
          // }
          break;
        case 6:
          // TODO: 计算有问题，先注释掉
          // const voucherNumbers = _.map(voucherList, 'voucherId').map(id => parseInt(id.match(/\d+$/)[0], 10));
          // for (let i = 0; i < voucherNumbers.length - 1; i++) {
          //   if (voucherNumbers[i + 1] - voucherNumbers[i] !== 1) {
          //     item.linkText = `存在断号, ${voucherList[i].voucherId}到${voucherList[i + 1].voucherId}之间`
          //     item.status = 'error'
          //   }
          // }
          break;
        default:
          break;
      }
    })
    otherErrorItem.subtitle = `共有${otherErrorItem.items.length}项类目，其中${otherErrorItem.items.filter(item => item.status == 'error').length}项类目有风险`
    return otherErrorItem
  }
}

module.exports = PeriodService;