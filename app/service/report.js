const Service = require('egg').Service;
const _ = require('lodash');
const dayjs = require('dayjs');
const idGenerateUtil = require("@jianghujs/jianghu/app/common/idGenerateUtil");
const validateUtil = require('@jianghujs/jianghu/app/common/validateUtil');
const { subjectCategoryEnum, tableEnum } = require('../constant/constant');
const { BizError, errorInfoEnum } = require('../constant/error');
const Formula = require('fparser');

const actionDataScheme = Object.freeze({
  getItemListOfAssetLiability: {
    type: 'object',
    additionalProperties: true,
    required: [],
    properties: {
      periodId: { anyOf: [{ type: "string" }, { type: "number" }] },
      periodIdList: { type: 'array', items: { type: 'string' } },
    },
  },
  getItemListOfProfit: {
    type: 'object',
    additionalProperties: true,
    required: [],
    properties: {
      periodId: { anyOf: [{ type: "string" }, { type: "number" }] },
      periodIdList: { type: 'array', items: { type: 'string' } },
    },
  },
  getItemListOfCashFlowEx: {
    type: 'object',
    additionalProperties: true,
    required: [],
    properties: {
      periodId: { anyOf: [{ type: "string" }, { type: "number" }] },
      periodIdList: { type: 'array', items: { type: 'string' } },
    },
  },
  getItemListOfCashFlow: {
    type: 'object',
    additionalProperties: true,
    required: [],
    properties: {
      periodId: { anyOf: [{ type: "string" }, { type: "number" }] },
    },
  },
  getItemListOfSummary: {
    type: 'object',
    additionalProperties: true,
    required: [],
    properties: {
      periodId: { anyOf: [{ type: "string" }, { type: "number" }] },
    },
  },
  saveFormulaListOfAssetLiability: {
    type: 'object',
    additionalProperties: true,
    required: ['itemId', 'formulaList'],
    properties: {
      itemId: { anyOf: [{ type: "string" }, { type: "number" }] },
      formulaList: {
        type: 'array',
        items: {
          type: 'object',
          required: ['subjectId', 'countDirection', 'accessRule'],
          properties: {
            subjectId: { anyOf: [{ type: "string" }, { type: "number" }] },
            countDirection: { type: "string", enum: ['+', '-'] },
            accessRule: { type: "string", enum: ['余额', '借方余额', '贷方余额', '科目借方余额', '科目贷方余额'] },
          }
        }
      },
    },
  },
  saveFormulaListOfProfit: {
    type: 'object',
    additionalProperties: true,
    required: ['itemId', 'formulaList'],
    properties: {
      itemId: { anyOf: [{ type: "string" }, { type: "number" }] },
      formulaList: {
        type: 'array',
        items: {
          type: 'object',
          required: ['subjectId', 'countDirection', 'accessRule'],
          properties: {
            subjectId: { anyOf: [{ type: "string" }, { type: "number" }] },
            countDirection: { type: "string", enum: ['+'] },
            accessRule: { type: "string", enum: ['余额'] },
          }
        }
      },
    },
  },
  saveFormulaListOfCashFlowEx: {
    type: 'object',
    additionalProperties: true,
    required: ['itemId', 'formulaList'],
    properties: {
      itemId: { anyOf: [{ type: "string" }, { type: "number" }] },
      formulaList: {
        type: 'array',
        items: {
          type: 'object',
          required: ['subjectId', 'countDirection', 'accessRule'],
          properties: {
            subjectId: { anyOf: [{ type: "string" }, { type: "number" }] },
            countDirection: { type: "string", enum: ['+', '-'] },
            accessRule: { type: "string", enum: ['借方发生额', '贷方发生额', '损益发生额'] },
          }
        }
      },
    },
  },

});


const calculateOccurAmountByVoucherList = (voucherList, subjectBalanceDirection) => {
  const sumValue = _.sumBy(voucherList, v => {
    const isSameDirection = subjectBalanceDirection === v.subjectBalanceDirection;
    return isSameDirection
      ? subjectBalanceDirection === '借' ? v.debit - v.credit : v.credit - v.debit
      : subjectBalanceDirection === '贷' ? v.debit - v.credit : v.credit - v.debit;
  });
  return sumValue || 0;
}

const calculateSumByFormulaList = (formulaList, key) => {
  if (!formulaList || formulaList.length == 0) { return null; };
  const sum = formulaList.reduce((sum, formula) => {
    if (formula.countDirection === '+') { return sum + formula[key]; };
    if (formula.countDirection === '-') { return sum - formula[key]; };
  }, 0)
  return parseFloat(sum.toFixed(2));
}

/**
 * 计算填充报表的L公式
 * 使用的插件：https://www.npmjs.com/package/fparser
 * @param {*} itemList 报表List 
 * @param {*} keys 计算的字段
 */
const fillItemComputeFormulaValueOfL = (itemList, keys) => {
  let rowObjMap = _.keyBy(itemList, (item) => `L${item.row}`);

  for (let key of keys) {
    let rowKeyValueMap = _.mapValues(rowObjMap, (item) => {
      return item[key] || 0;
    });

    for (let item of itemList) {
      if (!item.computeFormula || !item.computeFormula.startsWith("L")) {
        continue;
      }
      let computeFormula = item.computeFormula.replace(/(L\d+)/g, "[$1]");
      item[key] = new Formula(computeFormula).evaluate(rowKeyValueMap);
      rowKeyValueMap["L" + item.row] = item[key];
    }
  }
}

const fillFormulaListOfL = (itemList, keyList = []) => {
  const itemMap = _.keyBy(itemList, 'row');;
  itemList.forEach(item => {
    if (!item.computeFormula || !item.computeFormula.startsWith("L")) { return; }
    item.formulaList = `+${item.computeFormula}`
      .replace(/\s/g, "")
      .replace(/\+/g, "+>").replace(/\-/g, "->")
      .replace(/(L\d+)/g, "\$1,")
      .replace(/\L/g, "")
      .split(',').filter(v => !!v)
      .map(v => {
        const strList = v.split('>');
        const countDirection = strList[0];
        const targetRow = strList[1];
        const targetItem = itemMap[targetRow];
        const formula = {
          countDirection,
          formulaName: targetItem.itemName,
          itemAmountPeriodDesc: '本月数',
          itemAmountYearDesc: '本年数',
        };
        keyList.forEach(key => formula[key] = targetItem[key]);
        return formula;
      });
  });
};

class ReportService extends Service {

  async getItemListOfAssetLiability({ periodId }) {
    const { jianghuKnex } = this.app
    const period = await jianghuKnex(tableEnum.period, this.ctx).where({ periodId }).first();
    const { isCheckout } = period;


    let subjectBalancePeriodList = await jianghuKnex(tableEnum.view01_subject_balance_period, this.ctx).where({ periodId }).select();
    if (isCheckout != '已结账') {
      const { subjectBalanceList } = await this.service.period.computeSubjectBalanceOfNewCheckoutVoucherList({ periodId });
      subjectBalancePeriodList = subjectBalanceList;
    }
    const subjectBalancePeriodMap = _.keyBy(subjectBalancePeriodList, (obj) => { return obj.subjectId });

    const itemList = await jianghuKnex(tableEnum.view01_report_asset_liability_item, this.ctx).select();
    const formulaListAll = await jianghuKnex(tableEnum.report_asset_liability_formula, this.ctx).select();
    const formatNegativeAmountTo0 = (amount) => {
      if (!amount) { return 0; }
      return amount < 0 ? 0 : amount;
    };
    formulaListAll.forEach(formula => {
      const subjectBalancePeriod = subjectBalancePeriodMap[formula.subjectId] || {};
      const { subjectBalanceDirection, subjectName } = subjectBalancePeriod;
      if (formula.accessRule === '余额') {
        formula.itemEndAmountPeriod = subjectBalanceDirection === '借' ? subjectBalancePeriod.endDebit : subjectBalancePeriod.endCredit;
        formula.itemEndAmountYear = subjectBalanceDirection === '借' ? subjectBalancePeriod.endDebitYear : subjectBalancePeriod.endCreditYear;
        formula.itemStartAmountPeriod = subjectBalanceDirection === '借' ? subjectBalancePeriod.startDebit : subjectBalancePeriod.startCredit;
        formula.itemStartAmountYear = subjectBalanceDirection === '借' ? subjectBalancePeriod.startDebitYear : subjectBalancePeriod.startCreditYear;
      }
      if (formula.accessRule === '科目借方余额') {
        formula.itemEndAmountPeriod = formatNegativeAmountTo0(subjectBalancePeriod.endDebit - subjectBalancePeriod.endCredit);
        formula.itemEndAmountYear = formatNegativeAmountTo0(subjectBalancePeriod.endDebitYear - subjectBalancePeriod.endCreditYear);
        formula.itemStartAmountPeriod = formatNegativeAmountTo0(subjectBalancePeriod.startDebit - subjectBalancePeriod.startCredit);
        formula.itemStartAmountYear = formatNegativeAmountTo0(subjectBalancePeriod.startDebitYear - subjectBalancePeriod.startCreditYear);
      }
      if (formula.accessRule === '科目贷方余额') {
        formula.itemEndAmountPeriod = formatNegativeAmountTo0(subjectBalancePeriod.endCredit - subjectBalancePeriod.endDebit);
        formula.itemEndAmountYear = formatNegativeAmountTo0(subjectBalancePeriod.endCreditYear - subjectBalancePeriod.endDebitYear);
        formula.itemStartAmountPeriod = formatNegativeAmountTo0(subjectBalancePeriod.startCredit - subjectBalancePeriod.startDebit);
        formula.itemStartAmountYear = formatNegativeAmountTo0(subjectBalancePeriod.startCreditYear - subjectBalancePeriod.startDebitYear);
      }
      formula.formulaName = subjectName;
    })
    const formulaListGroup = _.groupBy(formulaListAll, 'itemId');
    itemList.forEach(item => {
      item.formulaList = formulaListGroup[item.itemId] || [];
      item.itemStartAmountPeriod = calculateSumByFormulaList(item.formulaList, 'itemStartAmountPeriod');
      item.itemEndAmountPeriod = calculateSumByFormulaList(item.formulaList, 'itemEndAmountPeriod');
      item.itemStartAmountYear = calculateSumByFormulaList(item.formulaList, 'itemStartAmountYear');
      item.itemEndAmountYear = calculateSumByFormulaList(item.formulaList, 'itemEndAmountYear');
    });

    // computeFormula 计算求和
    fillItemComputeFormulaValueOfL(itemList, ['itemStartAmountPeriod', 'itemEndAmountPeriod', 'itemStartAmountYear', 'itemEndAmountYear']);
    fillFormulaListOfL(itemList, ['itemStartAmountPeriod', 'itemEndAmountPeriod', 'itemStartAmountYear', 'itemEndAmountYear']);

    const assetList = itemList.filter(item => item.type === '资产');
    const liabilityList = itemList.filter(item => item.type === '负债');
    return { rows: itemList, assetList, liabilityList };
  }

  async getItemListOfProfit({ periodId }) {
    const { jianghuKnex } = this.app

    const financeYear = dayjs(periodId).year();
    const firstPeriodIdOfFinanceYear = `${financeYear}-00`;

    const subjectList = await jianghuKnex(tableEnum.subject, this.ctx).select();
    const subjectBalanceDirectionMap = Object.fromEntries(subjectList.map(obj => [obj.subjectId, obj.subjectBalanceDirection]));
    const subjectNameMap = Object.fromEntries(subjectList.map(obj => [obj.subjectId, obj.subjectName]));

    // periodData yearData
    let voucherListPeriod = [];
    let voucherListYear = [];
    const additionDishuiVoucher = await this.service.period.getAdditionDishuiVoucher({ periodId })
    await jianghuKnex.transaction(async (trx, trxKnex) => {
      if (additionDishuiVoucher.voucherEntryList.length > 0) {
        await trx(tableEnum.voucher, this.ctx).insert(additionDishuiVoucher.voucher);
        await trx(tableEnum.voucher_entry, this.ctx).insert(additionDishuiVoucher.voucherEntryList);
      }
      voucherListPeriod = await trx(tableEnum.view01_voucher_entry, this.ctx)
        .where({ periodId })
        .whereRaw(`ifnull(voucherTemplateName,'') not like '结转损益%'`)
        .groupBy('subjectId')
        .select(jianghuKnex.raw(`subjectId, sum(debit) as debit, sum(credit) credit`));
      voucherListYear = await trx(tableEnum.view01_voucher_entry, this.ctx)
        .whereRaw('? <= periodId and periodId <= ?', [firstPeriodIdOfFinanceYear, periodId])
        .whereRaw(`ifnull(voucherTemplateName,'') not like '结转损益%'`)
        .groupBy('subjectId')
        .select(jianghuKnex.raw(`subjectId, sum(debit) as debit, sum(credit) credit`));
      await trxKnex.rollback();
    })
    voucherListPeriod.forEach(voucher => voucher.subjectBalanceDirection = subjectBalanceDirectionMap[voucher.subjectId]);
    voucherListYear.forEach(voucher => voucher.subjectBalanceDirection = subjectBalanceDirectionMap[voucher.subjectId]);


    // occurAmount occurAmountYear
    const subjectBalancePeriodList = _.cloneDeep(subjectList);
    subjectBalancePeriodList.forEach(subjectBalancePeriod => {
      const voucherListPeriodCurr = voucherListPeriod.filter(sbp => `${sbp.subjectId}`.startsWith(`${subjectBalancePeriod.subjectId}`));
      const voucherListYearCurr = voucherListYear.filter(sbp => `${sbp.subjectId}`.startsWith(`${subjectBalancePeriod.subjectId}`));
      const subjectBalanceDirection = subjectBalancePeriod.subjectBalanceDirection;
      subjectBalancePeriod.occurAmount = calculateOccurAmountByVoucherList(voucherListPeriodCurr, subjectBalanceDirection);
      subjectBalancePeriod.occurAmountYear = calculateOccurAmountByVoucherList(voucherListYearCurr, subjectBalanceDirection);
    })
    const subjectBalancePeriodMap = _.keyBy(subjectBalancePeriodList, (obj) => { return obj.subjectId });

    // report itemList compute
    const itemList = await jianghuKnex(tableEnum.view01_report_profit_item, this.ctx).select();
    const formulaListAll = await jianghuKnex(tableEnum.report_profit_formula, this.ctx).select();
    formulaListAll.forEach(formula => {
      const subjectBalancePeriod = subjectBalancePeriodMap[formula.subjectId] || {};
      formula.itemOccurAmountPeriod = subjectBalancePeriod.occurAmount;
      formula.itemOccurAmountYear = subjectBalancePeriod.occurAmountYear;
      formula.formulaName = subjectNameMap[formula.subjectId];
    })
    const formulaListGroup = _.groupBy(formulaListAll, 'itemId');
    itemList.forEach(item => {
      item.formulaList = formulaListGroup[item.itemId] || [];
      item.itemOccurAmountPeriod = calculateSumByFormulaList(item.formulaList, 'itemOccurAmountPeriod');
      item.itemOccurAmountYear = calculateSumByFormulaList(item.formulaList, 'itemOccurAmountYear');
    });

    // computeFormula 计算求和
    fillItemComputeFormulaValueOfL(itemList, ['itemOccurAmountPeriod', 'itemOccurAmountYear']);
    fillFormulaListOfL(itemList, ['itemOccurAmountPeriod', 'itemOccurAmountYear']);

    return { rows: itemList };
  }
  
  async getItemListOfProfitOfAssist({ periodId, assistType }) {
    const { jianghuKnex } = this.app

    const subjectList = await jianghuKnex(tableEnum.subject, this.ctx).select();
    const subjectBalanceDirectionMap = Object.fromEntries(subjectList.map(obj => [obj.subjectId, obj.subjectBalanceDirection]));
    const subjectNameMap = Object.fromEntries(subjectList.map(obj => [obj.subjectId, obj.subjectName]));


    // assistList
    const assistIdKey = `assistIdOf${_.capitalize(assistType)}`;
    const assistNameKey = `assistNameOf${_.capitalize(assistType)}`;
    const assistDataList = await jianghuKnex(`assist_${assistType}`, this.ctx).select();
    assistDataList.push({ assistId: '', assistName: '--' });

    // periodList
    const financeYear = dayjs(periodId).year();
    const firstPeriodIdOfFinanceYear = `${financeYear}-00`;

    // periodData yearData
    const voucherListPeriod = await jianghuKnex(tableEnum.view01_voucher_entry, this.ctx)
      .where({ periodId })
      .whereRaw(`ifnull(voucherTemplateName,'') not like '结转损益%'`)
      .groupBy('assistId', 'subjectId')
      .select(jianghuKnex.raw(`subjectId, if(${assistIdKey} is null, '', ${assistIdKey}) as assistId, 
      ${assistNameKey} as assistName, sum(debit) as debit, sum(credit) credit`));
    const voucherListYear = await jianghuKnex(tableEnum.view01_voucher_entry, this.ctx)
      .whereRaw('? <= periodId and periodId <= ?', [firstPeriodIdOfFinanceYear, periodId])
      .whereRaw(`ifnull(voucherTemplateName,'') not like '结转损益%'`)
      .groupBy('assistId', 'subjectId')
      .select(jianghuKnex.raw(`subjectId, if(${assistIdKey} is null, '', ${assistIdKey}) as assistId, 
      ${assistNameKey} as assistName, sum(debit) as debit, sum(credit) credit`));
    voucherListPeriod.forEach(voucher => voucher.subjectBalanceDirection = subjectBalanceDirectionMap[voucher.subjectId]);
    voucherListYear.forEach(voucher => voucher.subjectBalanceDirection = subjectBalanceDirectionMap[voucher.subjectId]);

    // occurAmount occurAmountYear
    for (const assist of assistDataList) {
      const { assistId } = assist;
      const subjectBalancePeriodList = _.cloneDeep(subjectList);
      subjectBalancePeriodList.forEach(subjectBalancePeriod => {
        const voucherListPeriodCurr = voucherListPeriod.filter(sbp => sbp.assistId == assistId && `${sbp.subjectId}`.startsWith(`${subjectBalancePeriod.subjectId}`));
        const voucherListYearCurr = voucherListYear.filter(sbp => sbp.assistId == assistId && `${sbp.subjectId}`.startsWith(`${subjectBalancePeriod.subjectId}`));
        const subjectBalanceDirection = subjectBalancePeriod.subjectBalanceDirection;
        subjectBalancePeriod.occurAmount = calculateOccurAmountByVoucherList(voucherListPeriodCurr, subjectBalanceDirection);
        subjectBalancePeriod.occurAmountYear = calculateOccurAmountByVoucherList(voucherListYearCurr, subjectBalanceDirection);
        subjectBalancePeriod.assistId = assistId;
      })
      assist.subjectBalancePeriodList = subjectBalancePeriodList;
    }

    // report item compute
    const itemListTemp = await jianghuKnex(tableEnum.view01_report_profit_item, this.ctx).select();
    const formulaListAllTemp = await jianghuKnex(tableEnum.report_profit_formula, this.ctx).select();
    for (const assist of assistDataList) {
      const { subjectBalancePeriodList } = assist;
      const itemList = _.cloneDeep(itemListTemp);
      const formulaListAll = _.cloneDeep(formulaListAllTemp);
      formulaListAll.forEach(formula => {
        const subjectBalancePeriod = subjectBalancePeriodList.find(s => s.subjectId == formula.subjectId) || {};
        formula.itemOccurAmountPeriod = subjectBalancePeriod.occurAmount;
        formula.itemOccurAmountYear = subjectBalancePeriod.occurAmountYear;
        formula.formulaName = subjectNameMap[formula.subjectId];
      })

      const formulaListGroup = _.groupBy(formulaListAll, 'itemId');
      itemList.forEach(item => {
        item.formulaList = formulaListGroup[item.itemId] || [];
        item.itemOccurAmountPeriod = calculateSumByFormulaList(item.formulaList, 'itemOccurAmountPeriod');
        item.itemOccurAmountYear = calculateSumByFormulaList(item.formulaList, 'itemOccurAmountYear');
      });

      // computeFormula 计算求和
      fillItemComputeFormulaValueOfL(itemList, ['itemOccurAmountPeriod', 'itemOccurAmountYear']);
      fillFormulaListOfL(itemList, ['itemOccurAmountPeriod', 'itemOccurAmountYear']);

      assist.itemList = itemList;
    }

    return { rows: itemListTemp, assistDataList };
  }

  async getItemListOfProfitOfPeriodIdList({ periodIdList }) {
    const { jianghuKnex } = this.app

    const periodIdEnd = periodIdList[periodIdList.length - 1];
    const financeYear = dayjs(periodIdEnd).year();
    const firstPeriodIdOfFinanceYear = `${financeYear}-00`;

    const subjectList = await jianghuKnex(tableEnum.subject, this.ctx).select();
    const subjectBalanceDirectionMap = Object.fromEntries(subjectList.map(obj => [obj.subjectId, obj.subjectBalanceDirection]));
    const subjectNameMap = Object.fromEntries(subjectList.map(obj => [obj.subjectId, obj.subjectName]));


    // periodData yearData
    let voucherListPeriod = [];
    let voucherListYear = [];
    const additionDishuiVoucher = await this.service.period.getAdditionDishuiVoucher({ periodId: periodIdEnd })
    await jianghuKnex.transaction(async (trx, trxKnex) => {
      if (additionDishuiVoucher.voucherEntryList.length > 0) {
        await trx(tableEnum.voucher, this.ctx).insert(additionDishuiVoucher.voucher);
        await trx(tableEnum.voucher_entry, this.ctx).insert(additionDishuiVoucher.voucherEntryList);
      }
      voucherListPeriod = await trx(tableEnum.view01_voucher_entry, this.ctx)
        .whereIn('periodId', periodIdList)
        .whereRaw(`ifnull(voucherTemplateName,'') not like '结转损益%'`)
        .groupBy('subjectId')
        .select(jianghuKnex.raw(`subjectId, sum(debit) as debit, sum(credit) credit`));
      voucherListYear = await trx(tableEnum.view01_voucher_entry, this.ctx)
        .whereRaw('? <= periodId and periodId <= ?', [firstPeriodIdOfFinanceYear, periodIdEnd])
        .whereRaw(`ifnull(voucherTemplateName,'') not like '结转损益%'`)
        .groupBy('subjectId')
        .select(jianghuKnex.raw(`subjectId, sum(debit) as debit, sum(credit) credit`));
      await trxKnex.rollback();
    })
    voucherListPeriod.forEach(voucher => voucher.subjectBalanceDirection = subjectBalanceDirectionMap[voucher.subjectId]);
    voucherListYear.forEach(voucher => voucher.subjectBalanceDirection = subjectBalanceDirectionMap[voucher.subjectId]);


    // occurAmount occurAmountYear
    const subjectBalancePeriodList = _.cloneDeep(subjectList);
    subjectBalancePeriodList.forEach(subjectBalancePeriod => {
      const voucherListPeriodCurr = voucherListPeriod.filter(sbp => `${sbp.subjectId}`.startsWith(`${subjectBalancePeriod.subjectId}`));
      const voucherListYearCurr = voucherListYear.filter(sbp => `${sbp.subjectId}`.startsWith(`${subjectBalancePeriod.subjectId}`));
      const subjectBalanceDirection = subjectBalancePeriod.subjectBalanceDirection;
      subjectBalancePeriod.occurAmount = calculateOccurAmountByVoucherList(voucherListPeriodCurr, subjectBalanceDirection);
      subjectBalancePeriod.occurAmountYear = calculateOccurAmountByVoucherList(voucherListYearCurr, subjectBalanceDirection);
    })
    const subjectBalancePeriodMap = _.keyBy(subjectBalancePeriodList, (obj) => { return obj.subjectId });

    // report item compute
    const itemList = await jianghuKnex(tableEnum.view01_report_profit_item, this.ctx).select();
    const formulaListAll = await jianghuKnex(tableEnum.report_profit_formula, this.ctx).select();
    formulaListAll.forEach(formula => {
      const subjectBalancePeriod = subjectBalancePeriodMap[formula.subjectId] || {};
      formula.itemOccurAmountPeriod = subjectBalancePeriod.occurAmount;
      formula.itemOccurAmountYear = subjectBalancePeriod.occurAmountYear;
      formula.formulaName = subjectNameMap[formula.subjectId];
    })
    const formulaListGroup = _.groupBy(formulaListAll, 'itemId');
    itemList.forEach(item => {
      item.formulaList = formulaListGroup[item.itemId] || [];
      item.itemOccurAmountPeriod = calculateSumByFormulaList(item.formulaList, 'itemOccurAmountPeriod');
      item.itemOccurAmountYear = calculateSumByFormulaList(item.formulaList, 'itemOccurAmountYear');
    });

    // computeFormula 计算求和
    fillItemComputeFormulaValueOfL(itemList, ['itemOccurAmountPeriod', 'itemOccurAmountYear']);
    fillFormulaListOfL(itemList, ['itemOccurAmountPeriod', 'itemOccurAmountYear']);

    return { rows: itemList };
  }

  async getItemListOfProfitOfQuarter({ financeYear }) {
    const { jianghuKnex } = this.app;
    const periodListAll = await jianghuKnex(tableEnum.period, this.ctx)
      .where({ financeYear })
      .orderBy('periodId', 'asc')
      .select();
    if (periodListAll.length == 0) {
      return {};
    }
    const periodFirst = periodListAll[0];
    const periodLast = periodListAll[periodListAll.length - 1];
    const periodLastMonth = dayjs(periodLast.periodId).month() + 1;
    const periodFirstMonth = dayjs(periodFirst.periodId).month() + 1;

    // [ [3], [4,5,6] [7,8] ]
    const monthsListAll = [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10, 11, 12]];
    const monthsList = monthsListAll.map(months => months.filter(month => periodFirstMonth <= month && month <= periodLastMonth));

    const quarterProfitList = [];
    for (let i = 0; i < monthsList.length; i++) {
      const months = monthsList[i];
      const quarter = i + 1;
      const quarterText = `第${quarter}季度`;
      if (months.length == 0) {
        continue;
      }
      const periodIdList = months.map(month => dayjs().year(financeYear).month(month - 1).format('YYYY-MM'));
      const { rows } = await this.getItemListOfProfitOfPeriodIdList({ periodIdList });
      quarterProfitList.push({ quarter, quarterText, periodIdList, rows });
    }

    return { rows: quarterProfitList };
  }

  async getItemListOfCashFlow3({ periodId, periodIdList }) {
    const { jianghuKnex } = this.app;
    // Tip: 适配 现金流量表季报
    let periodIdStart = periodId;
    let periodIdEnd = periodId;
    if (!periodId) {
      periodIdStart = periodIdList[0];
      periodIdEnd = periodIdList[periodIdList.length - 1];
    }
    const financeYear = dayjs(periodIdStart).year();

    // 检查当前是否是 期中启用会计期间
    const periodStart = await jianghuKnex(tableEnum.period, this.ctx).where({ financeYear, isPeriodStart: '是' }).first();
    const periodMonth = periodStart ? dayjs(periodIdStart, "YYYY-MM").month() + 1 : null;
      
    const itemList = await jianghuKnex(tableEnum.report_cash_flow_item3, this.ctx).select();
    const subjectBalancePeriodList = await jianghuKnex(tableEnum.view01_subject_balance_period, this.ctx).where({periodId: periodIdStart}).select();
   
    const subjectCashFlowList = await jianghuKnex(tableEnum.subject, this.ctx).select();
    const cashFlowInItemIdMap = Object.fromEntries(subjectCashFlowList.map(subjectCashFlow => [`${subjectCashFlow.subjectId}`, subjectCashFlow.cashFlowInItemId]));
    const cashFlowOutItemIdMap = Object.fromEntries(subjectCashFlowList.map(subjectCashFlow => [`${subjectCashFlow.subjectId}`, subjectCashFlow.cashFlowOutItemId]));
    const xianjinSubjectBalanceList = subjectCashFlowList
      .filter(subjectCashFlow => subjectCashFlow.cashFlowInItemName == '现金及现金等价物')
      .map(subjectCashFlow => {
        return subjectBalancePeriodList.find(sbp => sbp.subjectId == subjectCashFlow.subjectId);
      });
    const xianjinSubjectIdList = xianjinSubjectBalanceList.map(s => s.subjectId);

    const periodDataList = await jianghuKnex(tableEnum.view01_voucher_entry, this.ctx)
      .whereRaw('? <= periodId and periodId <= ?', [periodIdStart, periodIdEnd])
      .whereRaw(`ifnull(voucherTemplateName,'') not like '结转损益%'`)
      .select(jianghuKnex.raw(`voucherId, subjectId, subjectLabel, subjectBalanceDirection, debit, credit`));
    const yearDataList = await jianghuKnex(tableEnum.view01_voucher_entry, this.ctx)
      .whereRaw('? <= periodId and periodId <= ?', [`${financeYear}-01`, periodIdEnd])
      .whereRaw(`ifnull(voucherTemplateName,'') not like '结转损益%'`)
      .select(jianghuKnex.raw(`voucherId, subjectId, subjectLabel, subjectBalanceDirection, debit, credit`));  
    const entryListGroup = _.groupBy(yearDataList, 'voucherId');
    const entryListFilterFunc = (entryList) =>{
      const entryListNew = entryList.filter(row => {
        const {voucherId} = row;
        const rowDirection = row.debit == 0 ? '贷': '借';
        const entryList = entryListGroup[voucherId];
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
      });
      return entryListNew;
    }
    
    periodDataList.forEach(subjectBalance => {
      subjectBalance.cashFlowInItemId = cashFlowInItemIdMap[subjectBalance.subjectId];
      subjectBalance.cashFlowOutItemId = cashFlowOutItemIdMap[subjectBalance.subjectId];
    });
    yearDataList.forEach(subjectBalance => {
      subjectBalance.cashFlowInItemId = cashFlowInItemIdMap[subjectBalance.subjectId];
      subjectBalance.cashFlowOutItemId = cashFlowOutItemIdMap[subjectBalance.subjectId];
    });
    const cashFlowInSubjectPeriodGroup = _.groupBy(periodDataList, 'cashFlowInItemId');
    const cashFlowOutSubjectPeriodGroup = _.groupBy(periodDataList, 'cashFlowOutItemId');
    const cashFlowInSubjectYearGroup = _.groupBy(yearDataList, 'cashFlowInItemId');
    const cashFlowOutSubjectYearGroup = _.groupBy(yearDataList, 'cashFlowOutItemId');
    itemList.forEach(item => {
      const cashFlowInSubjectPeriodList = entryListFilterFunc(cashFlowInSubjectPeriodGroup[item.itemId] || []);
      const cashFlowOutSubjectPeriodList = entryListFilterFunc(cashFlowOutSubjectPeriodGroup[item.itemId] || []);
      const cashFlowInSubjectYearList = entryListFilterFunc(cashFlowInSubjectYearGroup[item.itemId] || []);
      const cashFlowOutSubjectYearList = entryListFilterFunc(cashFlowOutSubjectYearGroup[item.itemId] || []);
      item.itemAmountPeriod = _.sumBy(cashFlowInSubjectPeriodList, (sb) => sb.credit) - _.sumBy(cashFlowOutSubjectPeriodList, (sb) => sb.debit);
      item.itemAmountYear = _.sumBy(cashFlowInSubjectYearList, (sb) => sb.credit) - _.sumBy(cashFlowOutSubjectYearList, (sb) => sb.debit);
      if(item.itemName.includes("支付的现金")) {
        item.itemAmountPeriod = -item.itemAmountPeriod;
        item.itemAmountYear = -item.itemAmountYear;
      }
      item.itemAmountYear = item.itemAmountYear + (periodMonth > 1 ? item.itemAmountMidYear : 0);
      // Tip: 调试用
      // if (item.row == 1) {
      //   // TODO: cashFlowInSubjectPeriodList/cashFlowOutSubjectPeriodList
      //   //     - 按照期初明细 处理数据
      //   console.log(`>>>>>>>>>>>>>>>>>>>>>>>>${item.row}  ${item.itemName}>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>`);
      //   console.log({ '流入凭证': cashFlowInSubjectPeriodList, '流出凭证': cashFlowOutSubjectPeriodList });
      //   console.log(`>>>>>>>>>>>>>>>>>>>>>>>>`);
      // }
      if (item.itemName == '加：期初现金余额') {
        item.itemAmountPeriod = _.sumBy(xianjinSubjectBalanceList, 'startDebit');
        item.itemAmountYear = _.sumBy(xianjinSubjectBalanceList, 'startDebitYear');
      }
    })
  
    fillItemComputeFormulaValueOfL(itemList, ['itemAmountPeriod', 'itemAmountYear']);
    fillFormulaListOfL(itemList, ['itemAmountPeriod', 'itemAmountYear']);
    return { rows: itemList, periodMonth };
  }

  async getItemListOfCashFlowOfQuarter({ financeYear }) {
    const { jianghuKnex } = this.app;
    const periodListAll = await jianghuKnex(tableEnum.period, this.ctx)
      .where({ financeYear })
      .orderBy('periodId', 'asc')
      .select();
    if (periodListAll.length == 0) {
      return {};
    }
    const periodFirst = periodListAll[0];
    const periodLast = periodListAll[periodListAll.length - 1];
    const periodLastMonth = dayjs(periodLast.periodId).month() + 1;
    const periodFirstMonth = dayjs(periodFirst.periodId).month() + 1;

    // [3 6 9 12]
    const monthFlowList = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
      .filter(month => month <= periodLastMonth)
      .filter(month => !([1, 2, 4, 5, 7, 8, 10, 11].includes(month) && month != periodLastMonth));

    const periodFlowList = [];
    const monthGroup = {
      0: [1, 2, 3],
      1: [4, 5, 6],
      2: [7, 8, 9],
      3: [10, 11, 12],
    };
    for (let i = 0; i < monthFlowList.length; i++) {
      const month = monthFlowList[i];
      const periodId = dayjs().year(financeYear).month(month - 1).format('YYYY-MM');
      if (month < periodFirstMonth) {
        periodFlowList.push({ periodId, rows: [] });
        continue;
      }
      const monthList = monthGroup[i].filter(m => m <= month);
      const periodIdList = monthList.map(m => dayjs().year(financeYear).month(m - 1).format('YYYY-MM'));
      const { rows } = await this.getItemListOfCashFlow3({ periodIdList });
      periodFlowList.push({ periodId, rows });
    }
    

    const quarterFlowList = [];
    for (let i = 0; i < periodFlowList.length; i++) {
      const periodFlow = periodFlowList[i];
      if (periodFlow.rows.length == 0) {
        continue;
      }
      const periodFlowRow = _.cloneDeep(periodFlow.rows);
      const { periodId } = periodFlow;
      const quarter = i + 1;
      const quarterText = `第${quarter}季度`;
      if (i == 0) {
        quarterFlowList.push({ quarter, quarterText, periodId, rows: periodFlowRow });
        continue;
      }

      const periodFlowPre = periodFlowList[i - 1];
      const periodFlowRowPre = periodFlowPre.rows;
      const periodFlowMapPre = _.keyBy(periodFlowRowPre, (obj) => { return obj.itemId });
      periodFlowRow.forEach(flowItem => {
        const flowItemPre = periodFlowMapPre[flowItem.itemId];
        if (flowItemPre) {
          flowItem.itemAmountPeriod = flowItem.itemAmountPeriod - flowItemPre.itemAmountPeriod;
          flowItem.itemAmountYear = flowItem.itemAmountYear;
        }
      })
      quarterFlowList.push({ quarter, quarterText, periodId, rows: periodFlowRow });
    }
    return { rows: quarterFlowList };
  }

  async getItemListOfSummary(actionData) {
    const { jianghuKnex } = this.app
    validateUtil.validate(actionDataScheme.getItemListOfSummary, actionData);
    const { periodId } = actionData

    // periodList
    const financeYear = dayjs(periodId).year();
    const periodList = await jianghuKnex(tableEnum.period, this.ctx)
      .where({ financeYear })
      .whereRaw('periodId <= ?', [periodId])
      .orderBy('periodId', 'desc')
      .select();
    const periodIdList = periodList.map(p => p.periodId);

    // periodData yearData
    let sbPeriodList = [];
    let sbYearList = [];
    const additionDishuiVoucher = await this.service.period.getAdditionDishuiVoucher({ periodId })
    await jianghuKnex.transaction(async (trx, trxKnex) => {
      if (additionDishuiVoucher.voucherEntryList.length > 0) {
        await trx(tableEnum.voucher, this.ctx).insert(additionDishuiVoucher.voucher);
        await trx(tableEnum.voucher_entry, this.ctx).insert(additionDishuiVoucher.voucherEntryList);
      }
      sbPeriodList = await trx(tableEnum.view01_voucher_entry, this.ctx)
        .where({ periodId })
        .whereRaw(`ifnull(voucherTemplateName,'') != ?`, ['结转损益-本期'])
        .groupBy('subjectId')
        .select(jianghuKnex.raw(`subjectId, sum(debit) as debit, sum(credit) credit`));
      sbYearList = await trx(tableEnum.view01_voucher_entry, this.ctx)
        .whereIn('periodId', periodIdList)
        .whereRaw(`ifnull(voucherTemplateName,'') != ?`, ['结转损益-本期'])
        .groupBy('subjectId')
        .select(jianghuKnex.raw(`subjectId, sum(debit) as debit, sum(credit) credit`));
      await trxKnex.rollback();
    })

    // occurAmount occurAmountYear
    const subjectList = await jianghuKnex(tableEnum.subject, this.ctx).select();
    const subjectBalancePeriodList = _.cloneDeep(subjectList);
    subjectBalancePeriodList.forEach(subjectBalancePeriod => {
      const sbPeriodListFilter = sbPeriodList.filter(sbp => `${sbp.subjectId}`.startsWith(`${subjectBalancePeriod.subjectId}`));
      const sbYearListFilter = sbYearList.filter(sbp => `${sbp.subjectId}`.startsWith(`${subjectBalancePeriod.subjectId}`));
      const subjectBalanceDirection = subjectBalancePeriod.subjectBalanceDirection;
      const occurDebit = _.sumBy(sbPeriodListFilter, 'debit');
      const occurCredit = _.sumBy(sbPeriodListFilter, 'credit');
      const occurAmount = subjectBalanceDirection === '借' ? occurDebit - occurCredit : occurCredit - occurDebit;
      const occurDebitYear = _.sumBy(sbYearListFilter, 'debit');
      const occurCreditYear = _.sumBy(sbYearListFilter, 'credit');
      const occurAmountYear = subjectBalanceDirection === '借' ? occurDebitYear - occurCreditYear : occurCreditYear - occurDebitYear;
      subjectBalancePeriod.occurAmount = occurAmount;
      subjectBalancePeriod.occurAmountYear = occurAmountYear;
    })

    // report item compute
    const itemList = await jianghuKnex(tableEnum.report_summary_item, this.ctx).select();
    const itemListOfProfit = await this.getItemListOfProfit({ periodId });
    // 生成Lxx INxxx SBAxxx SBCxxx SBDxxx 的映射
    let lRowObjMap = _.keyBy(itemList, (item) => {
      return "L" + item.row;
    });
    let inRowObjMap = _.keyBy(itemListOfProfit.rows, (item) => {
      return "IN" + item.row;
    });
    let sbaRowObjMap = _.keyBy(subjectBalancePeriodList.rows, (item) => {
      return "SBA_" + item.subjectId;
    });
    let sbcRowObjMap = _.keyBy(subjectBalancePeriodList.rows, (item) => {
      return "SBC_" + item.subjectId;
    });
    let sbdRowObjMap = _.keyBy(subjectBalancePeriodList.rows, (item) => {
      return "SBD_" + item.subjectId;
    });

    // 生成 Lxxx INxxx SBxxx 的值映射
    // Lxxx 本年累计金额
    let lItemOccurAmountYearValueMap = _.mapValues(lRowObjMap, (item) => {
      return 0;
    });
    // INxxx 本年累计金额
    let inItemOccurAmountYearValueMap = _.mapValues(inRowObjMap, (item) => {
      return item.itemOccurAmountYear || 0;
    });
    // SBAxxx 本年累计金额
    let sbaItemOccurAmountYearValueMap = _.mapValues(sbaRowObjMap, (item) => {
      return item.occurAmountYear || 0;
    });
    // SBCxxx 本年累计金额
    let sbcItemOccurAmountYearValueMap = _.mapValues(sbcRowObjMap, (item) => {
      return item.occurCreditYear || 0;
    });
    // SBDxxx 本年累计金额
    let sbdItemOccurAmountYearValueMap = _.mapValues(sbdRowObjMap, (item) => {
      return item.occurDebitYear || 0;
    });
    // Lxxx 本月累计金额
    let lItemOccurAmountPeriodValueMap = _.mapValues(lRowObjMap, (item) => {
      return 0;
    });
    // INxxx 本月累计金额
    let inItemOccurAmountPeriodValueMap = _.mapValues(inRowObjMap, (item) => {
      return item.itemOccurAmountPeriod || 0;
    });
    // SBAxxx 本月累计金额
    let sbaItemOccurAmountPeriodValueMap = _.mapValues(sbaRowObjMap, (item) => {
      return item.occurAmount;
    });
    // SBCxxx 本月累计金额
    let sbcItemOccurAmountPeriodValueMap = _.mapValues(sbcRowObjMap, (item) => {
      return item.occurCredit;
    });
    // SBDxxx 本月累计金额
    let sbdItemOccurAmountPeriodValueMap = _.mapValues(sbdRowObjMap, (item) => {
      return item.occurDebit;
    });

    // 合并本年累计金额
    let itemOccurAmountYearValueMap = _.assign(
      {},
      lItemOccurAmountYearValueMap,
      inItemOccurAmountYearValueMap,
      sbaItemOccurAmountYearValueMap,
      sbcItemOccurAmountYearValueMap,
      sbdItemOccurAmountYearValueMap
    );
    // 合并本月累计金额
    let itemOccurAmountPeriodValueMap = _.assign(
      {},
      lItemOccurAmountPeriodValueMap,
      inItemOccurAmountPeriodValueMap,
      sbaItemOccurAmountPeriodValueMap,
      sbcItemOccurAmountPeriodValueMap,
      sbdItemOccurAmountPeriodValueMap
    );

    for (let item of itemList) {
      if (!item.computeFormula) {
        continue;
      }

      let computeFormula = item.computeFormula;
      // 每个键用[]包裹，生成公式
      computeFormula = computeFormula.replace(/(L\d+)/g, "[$1]").replace(/(IN\d+)/g, "[$1]").replace(/(SBA_\d+)/g, "[$1]").replace(/(SBC_\d+)/g, "[$1]").replace(/(SBD_\d+)/g, "[$1]");

      // 统一使用eval计算公式
      let itemOccurAmountYearComputeFormula = computeFormula;
      let itemOccurAmountPeriodComputeFormula = computeFormula;
      let regKeys = computeFormula.match(/\[((L|IN|SBA|SBC|SBD)(\d|_)*)\]/ig);
      // 循环替换公式中的键替换为值
      for (let key of regKeys) {
        key = key.replace(/\[|\]/g, "");
        let reg = new RegExp(`\\[${key}\\]`, "g");
        itemOccurAmountYearComputeFormula = itemOccurAmountYearComputeFormula.replace(reg, `(${itemOccurAmountYearValueMap[key]})`);
        itemOccurAmountPeriodComputeFormula = itemOccurAmountPeriodComputeFormula.replace(reg, `(${itemOccurAmountPeriodValueMap[key]})`);
      }
      // 计算公式
      item.itemOccurAmountYear = eval(itemOccurAmountYearComputeFormula);
      item.itemOccurAmountPeriod = eval(itemOccurAmountPeriodComputeFormula)
      // 更新L字典
      itemOccurAmountYearValueMap["L" + item.row] = item.itemOccurAmountYear;
      itemOccurAmountPeriodValueMap["L" + item.row] = item.itemOccurAmountPeriod;
    }

    return { rows: itemList };
  }

  async saveFormulaListOfAssetLiability() {
    const { jianghuKnex } = this.app
    const ctx = this.ctx;
    const actionData = this.ctx.request.body.appData.actionData;
    validateUtil.validate(actionDataScheme.saveFormulaListOfAssetLiability, actionData);
    const { itemId, formulaList } = actionData

    const insertList = formulaList.map(formula => {
      return {
        itemId,
        subjectId: formula.subjectId,
        countDirection: formula.countDirection,
        accessRule: formula.accessRule,
      }
    });

    await jianghuKnex.transaction(async trx => {
      // TODO: 使用 replace 逻辑
      await trx(tableEnum.report_asset_liability_formula, this.ctx).where({ itemId }).delete();
      if (insertList.length > 0) {
        await trx(tableEnum.report_asset_liability_formula, this.ctx).insert(insertList);
      }
    })
  }

  async saveFormulaListOfProfit() {
    const { jianghuKnex } = this.app
    const ctx = this.ctx;
    const actionData = this.ctx.request.body.appData.actionData;
    validateUtil.validate(actionDataScheme.saveFormulaListOfProfit, actionData);
    const { itemId, formulaList } = actionData

    const insertList = formulaList.map(formula => {
      return {
        itemId,
        subjectId: formula.subjectId,
        countDirection: formula.countDirection,
        accessRule: formula.accessRule,
      }
    });

    await jianghuKnex.transaction(async trx => {
      // TODO: 使用 replace 逻辑
      await trx(tableEnum.report_profit_formula, this.ctx).where({ itemId }).delete();
      if (insertList.length > 0) {
        await trx(tableEnum.report_profit_formula, this.ctx).insert(insertList);
      }
    })
  }

  // Tip: 废弃代码  待删除
  async getItemListOfCashFlow({ periodId }) {
    const { jianghuKnex } = this.app
    const itemList = await jianghuKnex(tableEnum.report_cash_flow_item, this.ctx).select();
    const itemListOfAssetLiability = await this.getItemListOfAssetLiability({ periodId });
    const itemListOfProfit = await this.getItemListOfProfit({ periodId });
    const itemListOfCashFlowEx = await this.getItemListOfCashFlowEx({ periodId });

    // 生成Lxx BAxxx_1 BAxxx_2 INxxx EXxxx 的映射
    let lRowObjMap = _.keyBy(itemList, (item) => {
      return "L" + item.row;
    });
    let ba1RowObjMap = _.keyBy(itemListOfAssetLiability.rows, (item) => {
      return `BA${item.row}_1`;
    });
    let ba2RowObjMap = _.keyBy(itemListOfAssetLiability.rows, (item) => {
      return `BA${item.row}_2`;
    });
    let inRowObjMap = _.keyBy(itemListOfProfit.rows, (item) => {
      return "IN" + item.row;
    });
    let exRowObjMap = _.keyBy(itemListOfCashFlowEx.rows, (item) => {
      return "EX" + item.row;
    });

    // 生成 Lxxx BAxxx_1 BAxxx_2 INxxx EXxxx 的值映射  
    // BAxxx_1 资产负债-年初
    let ba1ItemOccurAmountYearValueMap = _.mapValues(ba1RowObjMap, (item) => {
      return item.itemStartAmountYear || 0;
    });
    // BAxxx_2 资产负债-年末
    let ba2itemOccurAmountYearValueMap = _.mapValues(ba2RowObjMap, (item) => {
      return item.itemEndAmountYear || 0;
    });
    // BAxxx_1 资产负债-期初
    let ba1ItemOccurAmountPeriodValueMap = _.mapValues(ba1RowObjMap, (item) => {
      return item.itemStartAmountPeriod || 0;
    });
    // BAxxx_2 资产负债-期末
    let ba2itemOccurAmountPeriodValueMap = _.mapValues(ba2RowObjMap, (item) => {
      return item.itemEndAmountPeriod || 0;
    });
    // Lxxx 本年累计金额
    let lItemOccurAmountYearValueMap = _.mapValues(lRowObjMap, (item) => {
      return item.itemOccurAmountYear || 0;
    });
    // INxxx 本年累计金额
    let inItemOccurAmountYearValueMap = _.mapValues(inRowObjMap, (item) => {
      return item.itemOccurAmountYear || 0;
    });
    // EXxxx 本年累计金额
    let exItemOccurAmountYearValueMap = _.mapValues(exRowObjMap, (item) => {
      return item.itemOccurAmountYear || 0;
    });
    // Lxxx 本月累计金额
    let lItemOccurAmountPeriodValueMap = _.mapValues(lRowObjMap, (item) => {
      return item.itemOccurAmountPeriod || 0;
    });

    // INxxx 本月累计金额
    let inItemOccurAmountPeriodValueMap = _.mapValues(inRowObjMap, (item) => {
      return item.itemOccurAmountPeriod || 0;
    });
    // ex 本月累计金额
    let exItemOccurAmountPeriodValueMap = _.mapValues(exRowObjMap, (item) => {
      return item.itemOccurAmountPeriod || 0;
    });

    // 合并本年累计金额
    let itemOccurAmountYearValueMap = _.assign(
      {},
      lItemOccurAmountYearValueMap,
      ba1ItemOccurAmountYearValueMap,
      ba2itemOccurAmountYearValueMap,
      inItemOccurAmountYearValueMap,
      exItemOccurAmountYearValueMap
    );
    // 合并本月累计金额
    let itemOccurAmountPeriodValueMap = _.assign(
      {},
      lItemOccurAmountPeriodValueMap,
      ba1ItemOccurAmountPeriodValueMap,
      ba2itemOccurAmountPeriodValueMap,
      inItemOccurAmountPeriodValueMap,
      exItemOccurAmountPeriodValueMap
    );

    for (let item of itemList) {
      if (!item.computeFormula) {
        continue;
      }

      // if (item.id == 7) {
      //   debugger
      // }

      let computeFormula = item.computeFormula;
      // computeFormulate的 BA[xx,xx] 替换为 BAxx_xx，以免与公式中的[]冲突
      computeFormula = computeFormula.replace(/(BA)\[(\d+),(\d+)\]/g, "$1$2_$3");
      // 每个键用[]包裹，生成公式
      computeFormula = computeFormula.replace(/(L\d+)/g, "[$1]").replace(/(BA\d+_\d+)/g, "[$1]").replace(/(IN\d+)/g, "[$1]").replace(/(EX\d+)/g, "[$1]");

      // 统一使用eval计算公式
      let itemOccurAmountYearComputeFormula = computeFormula;
      let itemOccurAmountPeriodComputeFormula = computeFormula;
      let regKeys = computeFormula.match(/\[((L|IN|BA|EX)(\d|_)*)\]/ig);
      // 循环替换公式中的键替换为值
      for (let key of regKeys) {
        key = key.replace(/\[|\]/g, "");
        let reg = new RegExp(`\\[${key}\\]`, "g");
        itemOccurAmountYearComputeFormula = itemOccurAmountYearComputeFormula.replace(reg, `(${itemOccurAmountYearValueMap[key]})`);
        itemOccurAmountPeriodComputeFormula = itemOccurAmountPeriodComputeFormula.replace(reg, `(${itemOccurAmountPeriodValueMap[key]})`);
      }
      // 计算公式
      item.itemOccurAmountYear = eval(itemOccurAmountYearComputeFormula);
      item.itemOccurAmountPeriod = eval(itemOccurAmountPeriodComputeFormula)
      // 更新L字典
      itemOccurAmountYearValueMap["L" + item.row] = item.itemOccurAmountYear;
      itemOccurAmountPeriodValueMap["L" + item.row] = item.itemOccurAmountPeriod;
    }

    return { rows: itemList };
  }
  // Tip: 废弃代码  待删除
  async getItemListOfCashFlowEx({ periodId }) {
    const { jianghuKnex } = this.app
    // periodList
    const financeYear = dayjs(periodId).year();
    const periodList = await jianghuKnex(tableEnum.period, this.ctx)
      .where({ financeYear })
      .whereRaw('periodId <= ?', [periodId])
      .orderBy('periodId', 'desc')
      .select();
    const periodIdList = periodList.map(p => p.periodId);

    // periodData yearData
    const sbPeriodList = await jianghuKnex(tableEnum.view01_voucher_entry, this.ctx)
      .where({ periodId })
      .whereRaw(`ifnull(voucherTemplateName,'') != ?`, ['结转损益-本期'])
      .groupBy('subjectId')
      .select(jianghuKnex.raw(`subjectId, sum(debit) as debit, sum(credit) credit`));
    const sbYearList = await jianghuKnex(tableEnum.view01_voucher_entry, this.ctx)
      .whereIn('periodId', periodIdList)
      .whereRaw(`ifnull(voucherTemplateName,'') != ?`, ['结转损益-本期'])
      .groupBy('subjectId')
      .select(jianghuKnex.raw(`subjectId, sum(debit) as debit, sum(credit) credit`));

    // occurAmount occurAmountYear
    const subjectList = await jianghuKnex(tableEnum.subject, this.ctx).select();
    const subjectBalancePeriodList = _.cloneDeep(subjectList);
    subjectBalancePeriodList.forEach(subjectBalancePeriod => {
      const sbPeriodListFilter = sbPeriodList.filter(sbp => `${sbp.subjectId}`.startsWith(`${subjectBalancePeriod.subjectId}`));
      const sbYearListFilter = sbYearList.filter(sbp => `${sbp.subjectId}`.startsWith(`${subjectBalancePeriod.subjectId}`));
      const subjectBalanceDirection = subjectBalancePeriod.subjectBalanceDirection;
      const occurDebit = _.sumBy(sbPeriodListFilter, 'debit');
      const occurCredit = _.sumBy(sbPeriodListFilter, 'credit');
      const occurAmount = subjectBalanceDirection === '借' ? occurDebit - occurCredit : occurCredit - occurDebit;
      const occurDebitYear = _.sumBy(sbYearListFilter, 'debit');
      const occurCreditYear = _.sumBy(sbYearListFilter, 'credit');
      const occurAmountYear = subjectBalanceDirection === '借' ? occurDebitYear - occurCreditYear : occurCreditYear - occurDebitYear;
      subjectBalancePeriod.occurAmount = occurAmount;
      subjectBalancePeriod.occurAmountYear = occurAmountYear;
    })
    const subjectBalancePeriodMap = _.keyBy(subjectBalancePeriodList, (obj) => { return obj.subjectId });

    const itemList = await jianghuKnex(tableEnum.view01_report_cash_flow_ex_item, this.ctx).select();
    const formulaListAll = await jianghuKnex(tableEnum.report_cash_flow_ex_formula, this.ctx).select();
    formulaListAll.forEach(formula => {
      const subjectBalancePeriod = subjectBalancePeriodMap[formula.subjectId] || {};
      switch (formula.accessRule) {
        case '借方发生额':
          formula.itemOccurAmountPeriod = subjectBalancePeriod.occurDebit;
          formula.itemOccurAmountYear = subjectBalancePeriod.occurDebitYear;
          break;
        case '贷方发生额':
          formula.itemOccurAmountPeriod = subjectBalancePeriod.occurCredit;
          formula.itemOccurAmountYear = subjectBalancePeriod.occurCreditYear;
          break;
        case '损益发生额':
          formula.itemOccurAmountPeriod = subjectBalancePeriod.occurAmount;
          formula.itemOccurAmountYear = subjectBalancePeriod.occurAmountYear;
          break;
        default:
          formula.itemOccurAmountPeriod = 0;
          formula.itemOccurAmountYear = 0;
      }
    })
    const formulaListGroup = _.groupBy(formulaListAll, 'itemId');
    itemList.forEach(item => {
      if (item.formulaCount === 0) {
        return;
      }
      const formulaList = formulaListGroup[item.itemId];
      if (formulaList.length > 0) {
        item.itemOccurAmountPeriod = _.sumBy(formulaList, 'itemOccurAmountPeriod');
        item.itemOccurAmountYear = _.sumBy(formulaList, 'itemOccurAmountYear');
      }
    });

    fillItemComputeFormulaValueOfL(itemList, ['itemOccurAmountPeriod', 'itemOccurAmountYear']);

    return { rows: itemList };
  }
}

module.exports = ReportService;