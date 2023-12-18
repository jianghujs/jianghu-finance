const Service = require('egg').Service;
const dayjs = require('dayjs');
const _ = require('lodash');
const idGenerateUtil = require("@jianghujs/jianghu/app/common/idGenerateUtil");
const validateUtil = require('@jianghujs/jianghu/app/common/validateUtil');
const { subjectCategoryEnum, tableEnum } = require('../constant/constant');
const { BizError, errorInfoEnum } = require('../constant/error');

const actionDataScheme = Object.freeze({
  getItemListOfGeneralLedger: {
    type: 'object',
    additionalProperties: true,
    required: ['periodIdList'],
    properties: {
      periodIdList: { anyOf: [{ type: "array" }, { type: "string" }] }
    }
  },
  getItemListOfMulticolumnLedger: {
    type: 'object',
    additionalProperties: true,
    required: ['periodIdList', 'subjectId'],
    properties: {
      // periodId: { anyOf: [{ type: "string" }, { type: "number" }] },
      periodIdList: { anyOf: [{ type: "array" }, { type: "string" }] },
      subjectId: { anyOf: [{ type: "string" }, { type: "number" }] },
    },
  },
  getItemListOfAuxiliaryDetailedLedger: {
    type: 'object',
    additionalProperties: true,
    required: ['periodIdList', 'subjectId', 'assistType'],
    properties: {
      periodIdList: { anyOf: [{ type: "string" }, { type: "array" }] },
      subjectId: { anyOf: [{ type: "string" }, { type: "number" }] },
      assistType: { type: "string" },
      assistId: { anyOf: [{ type: "string" }, { type: "number" }, { type: "null" }] },
    },
  },
  getItemListOfAuxiliaryBalanceSheet: {
    type: 'object',
    additionalProperties: true,
    required: ['periodIdList', 'subjectId', 'assistType'],
    properties: {
      periodIdList: { anyOf: [{ type: "string" }, { type: "array" }] },
      subjectId: { anyOf: [{ type: "string" }, { type: "number" }] },
      assistType: { type: "string" },
      assistId: { anyOf: [{ type: "string" }, { type: "number" }, { type: "null" }] },
    },
  },
  getItemListOfSubjectBalance: {
    type: 'object',
    additionalProperties: true,
    required: ['periodIdList'],
    properties: {
      periodIdList: { anyOf: [{ type: "array" }, { type: "string" }] }
    }
  },  
});

class AccountService extends Service {

  async getItemListOfGeneralLedger(actionData) {
    const { jianghuKnex } = this.app;
    validateUtil.validate(actionDataScheme.getItemListOfGeneralLedger, actionData);
    const { periodIdList } = actionData;

    const startPeriodId = periodIdList[periodIdList.length - 1];
    const endPeriodId = periodIdList[0];
    const period = await jianghuKnex(tableEnum.period, this.ctx).where({ periodId: startPeriodId }).select().first();
    const firstPeriodIdOfFinanceYear = `${period.financeYear}-00`;

    const subjectBalancePeriodList = await jianghuKnex(tableEnum.view01_subject_balance_period, this.ctx)
      .where("periodId", "in", periodIdList).where({subjectLevel: '1'})
      .orderBy('subjectId', 'asc')
      .orderBy('periodId', 'asc')
      .select();

    const subjectBalancePeriodListOfFinanceYear = await jianghuKnex(tableEnum.view01_subject_balance_period, this.ctx)
      .where({subjectLevel: '1'})
      .whereRaw('? <= periodId', [firstPeriodIdOfFinanceYear])
      .whereRaw('periodId <= ?', [endPeriodId])
      .orderBy('subjectId', 'asc')
      .orderBy('periodId', 'asc')
      .select();  
    
    // 生成列表
    const rows = [];
    subjectBalancePeriodList.forEach(subjectBalancePeriod => {
      const { subjectBalanceDirection, subjectId, periodId } = subjectBalancePeriod;
      const previouList = subjectBalancePeriodListOfFinanceYear
        .filter(sbp => sbp.subjectId === subjectId)
        .filter(sbp => sbp.periodId <= periodId);
      rows.push({
        ...subjectBalancePeriod,
        entryAbstract: '期初余额',
        debit: 0,
        credit: 0,
        subjectBalanceDirection: subjectBalancePeriod.startDebit||subjectBalancePeriod.startCredit? subjectBalanceDirection: '平',
        balance: subjectBalanceDirection == '借'? subjectBalancePeriod.startDebit: subjectBalancePeriod.startCredit,
      });
      rows.push({
        ...subjectBalancePeriod,
        entryAbstract: '本期合计',
        debit: subjectBalancePeriod.occurDebit,
        credit: subjectBalancePeriod.occurCredit,
        subjectBalanceDirection: subjectBalancePeriod.endDebit||subjectBalancePeriod.endCredit? subjectBalanceDirection: '平',
        balance: subjectBalanceDirection == '借'? subjectBalancePeriod.endDebit: subjectBalancePeriod.endCredit,
      });
      rows.push({
        ...subjectBalancePeriod,
        entryAbstract: '本年累计',
        debit: _.sumBy(previouList, 'occurDebit'),
        credit: _.sumBy(previouList, 'occurCredit'),
        subjectBalanceDirection: (subjectBalancePeriod.endDebitYear||subjectBalancePeriod.endCreditYear)? subjectBalanceDirection: '平',
        balance: subjectBalanceDirection == '借'? subjectBalancePeriod.endDebit: subjectBalancePeriod.endCredit,
      });
    })
    return { rows };
  }

  // 将科目余额中多个会计期间的数据合并
  async mergeSubjectBalanceMultiplePeriodData(data) {
    // 按subjectId分组并去重，保留periodId最大的那条数据，并将重复数据的occurDebit累加到已有数据的occurDebit中
    const groupedData = data.reduce((acc, cur) => {
      if (acc[cur.subjectId]) {
        if (cur.periodId > acc[cur.subjectId].periodId) {
          acc[cur.subjectId] = {
            ...cur,
            occurDebit: acc[cur.subjectId].occurDebit + cur.occurDebit,
            occurCredit: acc[cur.subjectId].occurCredit + cur.occurCredit,
            occurAmount: acc[cur.subjectId].occurAmount + cur.occurAmount,
          };
        } else {
          acc[cur.subjectId].occurDebit += cur.occurDebit;
          acc[cur.subjectId].occurCredit += cur.occurCredit;
          acc[cur.subjectId].occurAmount += cur.occurAmount;
        }
      } else {
        acc[cur.subjectId] = cur;
      }
      return acc;
    }, {});
  
    // 将对象转换成数组，并对每个元素进行进一步处理
    const result = Object.values(groupedData).map((item) => {
      // 获取重复数据中periodId最小的那一条数据
      const minPeroidData = data
        .filter((d) => d.subjectId === item.subjectId && d.periodId !== item.periodId)
        .reduce((acc, cur) => (cur.periodId < acc.periodId ? cur : acc), item);
  
      // 获取重复数据中periodId最大的那一条数据
      const maxPeroidData = data
        .filter((d) => d.subjectId === item.subjectId && d.periodId !== item.periodId)
        .reduce((acc, cur) => (cur.periodId > acc.periodId ? cur : acc), item);
  
      return {
        ...item,
        startDebit: minPeroidData.startDebit,
        startCredit: minPeroidData.startCredit,
        endDebit: maxPeroidData.endDebit,
        endCredit: maxPeroidData.endCredit,
        endAmount: maxPeroidData.endAmount
      };
    });
  
    return result;    
  }

  async getItemListOfMulticolumnLedger(actionData) {
    const { jianghuKnex } = this.app;
    validateUtil.validate(actionDataScheme.getItemListOfMulticolumnLedger, actionData);
    const { periodIdList, subjectId } = actionData;
    const startPeriodId = periodIdList[periodIdList.length - 1];
    const endPeriodId = periodIdList[0];
    const period = await jianghuKnex(tableEnum.period, this.ctx).where({ periodId: startPeriodId }).select().first();
    const firstPeriodIdOfFinanceYear = `${period.financeYear}-00`;


    const subjectBalanceList = await jianghuKnex(tableEnum.view01_subject_balance_period, this.ctx)
      .whereIn('periodId', periodIdList)
      .where({ subjectId })
      .orderBy('periodId', 'desc')
      .select();
    const subjectBalanceListOfFinanceYear = await jianghuKnex(tableEnum.view01_subject_balance_period, this.ctx)
      .whereRaw('? <= periodId', [firstPeriodIdOfFinanceYear])
      .whereRaw('periodId <= ?', [endPeriodId])
      .where({ subjectId })
      .orderBy('periodId', 'desc')
      .select();

    const voucherEntryList = await jianghuKnex(tableEnum.view01_voucher_entry, this.ctx)
      .where("periodId", "in", periodIdList).where('subjectId', 'like', `${subjectId}%`)
      .orderBy('periodId', 'asc')
      .select();
    const voucherList = _.orderBy(_.uniqBy(voucherEntryList, 'voucherId'), ['periodId', 'voucherNumber'], ['asc', 'asc']);
    const subjectBalancePeriodEnd = subjectBalanceList[0];
    const subjectBalancePeriodStart = subjectBalanceList[subjectBalanceList.length - 1];
    const parentSubjectBalanceDirection = subjectBalancePeriodStart.subjectBalanceDirection;  
    const startBalance = subjectBalancePeriodStart.startDebit || subjectBalancePeriodStart.startCredit || 0;
   
    const voucherEntryListOfDebit = _.orderBy(_.uniqBy(voucherEntryList.filter(ve => ve.debit), 'subjectId'), ['subjectId'], ['asc']);
    const debitSubjectList = voucherEntryListOfDebit.map(ve => { 
      return {
        subjectId: ve.subjectId,
        subjectName: ve.subjectName,
        subjectBalanceDirection: ve.subjectBalanceDirection,
      }
    })
    const voucherEntryListOfCredit = _.orderBy(_.uniqBy(voucherEntryList.filter(ve => ve.credit), 'subjectId'), ['subjectId'], ['asc']);
    const creditSubjectList = voucherEntryListOfCredit.map(ve => { 
      return {
        subjectId: ve.subjectId,
        subjectName: ve.subjectName,
        subjectBalanceDirection: ve.subjectBalanceDirection,
      }
    })
    
    // 添加多栏值
    voucherEntryList.forEach(voucherEntry => {
      voucherEntry[`${voucherEntry.subjectId}_debit`] = voucherEntry.debit;
      voucherEntry[`${voucherEntry.subjectId}_credit`] = voucherEntry.credit;
    });
    
    const rows = [];
    let currentBalance = startBalance;
    voucherList.forEach(voucher => {
      const { periodId, voucherId, voucherAt, entryAbstract } = voucher;
      const voucherEntryListOfCurrentVoucher = voucherEntryList.filter(ve => ve.voucherId === voucherId );
      const row = {
        id: rows.length + 1,
        periodId, voucherId, voucherAt,
        debit: _.sumBy(voucherEntryListOfCurrentVoucher, 'debit') > 0 ? _.sumBy(voucherEntryListOfCurrentVoucher, 'debit').toFixed(2) : '',
        credit: _.sumBy(voucherEntryListOfCurrentVoucher, 'credit') > 0 ? _.sumBy(voucherEntryListOfCurrentVoucher, 'credit').toFixed(2) : '',
        entryAbstract,
      }
      debitSubjectList.forEach(subject => {
        const mactchRows = voucherEntryListOfCurrentVoucher.filter(row => row.subjectId === subject.subjectId && row.debit);
        const debitKey = `debit_${subject.subjectId}`;
        const debitData = _.sumBy(mactchRows, 'debit') ? _.sumBy(mactchRows, 'debit').toFixed(2) : null;
        row[debitKey] = debitData;
      })
      creditSubjectList.forEach(subject => {
        const mactchRows = voucherEntryListOfCurrentVoucher.filter(row => row.subjectId === subject.subjectId && row.credit);
        const creditKey = `credit_${subject.subjectId}`;
        const creditData = _.sumBy(mactchRows, 'credit') ? _.sumBy(mactchRows, 'credit').toFixed(2) : null;
        row[creditKey] = creditData;
      })
      row.debitSum = _.sumBy(voucherEntryListOfCurrentVoucher, 'debit').toFixed(2);
      row.creditSum = _.sumBy(voucherEntryListOfCurrentVoucher, 'credit').toFixed(2);
      // TODO: 假设子科目 的余额方向 不一样该怎么算
      const voucherAmount = parentSubjectBalanceDirection == '借'? row.debitSum - row.creditSum: row.creditSum - row.debitSum;
      currentBalance += voucherAmount;
      row.balance = currentBalance.toFixed(2);
      if (row.balance == 0.00) { row.balance = 0; }
      row.parentSubjectBalanceDirection = row.balance ? parentSubjectBalanceDirection : '平';
      rows.push(row);
    });

    for (let i = periodIdList.length - 1; i >= 0; i--) {
      const currentPeriodId = periodIdList[i];
      const currentSubjectBalance = subjectBalanceList.find(sb => sb.periodId === currentPeriodId);
      const previouList = subjectBalanceListOfFinanceYear
        .filter(sbp => sbp.periodId <= currentPeriodId);
      let nextPeriodVoucherIndex = rows.findIndex(row => row.periodId > currentPeriodId);
      if (nextPeriodVoucherIndex === -1) {
        nextPeriodVoucherIndex = rows.length;
      }
      rows.splice(nextPeriodVoucherIndex, 0, {
        voucherAt: dayjs(currentPeriodId).endOf('month').format('YYYY-MM-DD'),
        entryAbstract: '本年累计',
        parentSubjectBalanceDirection: (currentSubjectBalance.endDebit || currentSubjectBalance.endCredit) ? parentSubjectBalanceDirection : '平',
        debit: _.sumBy(previouList, 'occurDebit'),
        credit: _.sumBy(previouList, 'occurCredit'),
        balance: currentSubjectBalance.endDebit || currentSubjectBalance.endCredit,
      });
      rows.splice(nextPeriodVoucherIndex, 0, {
        voucherAt: dayjs(currentPeriodId).endOf('month').format('YYYY-MM-DD'),
        entryAbstract: '本期合计',
        parentSubjectBalanceDirection: (currentSubjectBalance.endDebit || currentSubjectBalance.endCredit) ? parentSubjectBalanceDirection : '平',
        debit: currentSubjectBalance.occurDebit,
        credit: currentSubjectBalance.occurCredit,
        balance: currentSubjectBalance.endDebit || currentSubjectBalance.endCredit,
      });
    }

    rows.unshift({
      voucherAt: dayjs(startPeriodId).startOf('month').format('YYYY-MM-DD'),
      entryAbstract: '期初余额',
      debit: 0,
      credit: 0,
      parentSubjectBalanceDirection: startBalance ? parentSubjectBalanceDirection : '平',
      balance: startBalance,
    });

    // 兼容一下 account-subjectDetail.html 的数据
    rows.forEach(row => {
      row.subjectBalanceDirection = row.parentSubjectBalanceDirection;
    });

    return { rows, debitSubjectList, creditSubjectList };
  }
  
  async getItemListOfAuxiliaryDetailedLedger(actionData) {
    const { jianghuKnex } = this.app;
    validateUtil.validate(actionDataScheme.getItemListOfAuxiliaryDetailedLedger, actionData);
    const { subjectId, assistType, assistId } = actionData;
    
    const { periodIdList } = actionData;
    const startPeriodId = periodIdList[periodIdList.length - 1];
    const period = await jianghuKnex(tableEnum.period, this.ctx).where({ periodId: startPeriodId }).select().first();
    const firstPeriodIdOfFinanceYear = `${period.financeYear}-00`;


    // Tip: 这个余额在这里没有啥计算价值
    const subjectBalancePeriodList = await jianghuKnex(tableEnum.view01_subject_balance_period, this.ctx)
      .where({ subjectId })
      .where("periodId", "in", periodIdList)
      .orderBy('subjectId', 'asc')
      .select();
    const subjectBalancePeriodEnd = subjectBalancePeriodList[0];
    const { subjectBalanceDirection } = subjectBalancePeriodEnd;

    const assistIdWhere = { };
    if (assistId) {
      assistIdWhere[`assistIdOf${_.capitalize(assistType)}`] = assistId;
    }
    let voucherEntryList = [];
    
    const prePeriodResult = await jianghuKnex(tableEnum.view01_voucher_entry, this.ctx)
      .whereRaw('periodId < ?', [startPeriodId])
      .where({ subjectId, ...assistIdWhere })
      .select(jianghuKnex.raw('sum(debit) as debit, sum(credit) credit'));

    const startDebit = prePeriodResult[0].debit || 0;
    const startCredit = prePeriodResult[0].credit || 0;
    const startBalance = subjectBalanceDirection == '借' ? startDebit-startCredit : startCredit-startDebit;
    voucherEntryList.unshift({
      voucherAt: dayjs(startPeriodId).startOf('month').format('YYYY-MM-DD'),
      entryAbstract: '期初余额',
      debit: 0,
      credit: 0,
      subjectBalanceDirection: startBalance? subjectBalanceDirection: '平',
      balance: startBalance,
    });

    let currentPeriodVoucherEntryList = await jianghuKnex(tableEnum.view01_voucher_entry, this.ctx)
      .where("periodId", "in", periodIdList)
      .where({ subjectId, ...assistIdWhere })
      .orderBy('periodId', 'asc')
      .orderBy('voucherNumber', 'asc')
      .select();
    
    // 计算余额 变化
    let balance = startBalance;
    currentPeriodVoucherEntryList.forEach(voucherEntry => {
      const { debit, credit } = voucherEntry;
      let voucherEntryAmount = voucherEntry.subjectBalanceDirection == '借'? debit - credit: credit - debit;
      balance += voucherEntryAmount;
      voucherEntry.balance = balance;
      if(voucherEntry.balance.toFixed(0) == 0) {
        voucherEntry.balance = '';
        voucherEntry.subjectBalanceDirection = '平';
      }
      voucherEntryList.push(voucherEntry);
    });


    for (let i = periodIdList.length - 1; i >= 0; i--) {
      const currentPeriodId = periodIdList[i];
      let nextPeriodVoucherIndex = voucherEntryList.findIndex(row => row.periodId > currentPeriodId);
      if (nextPeriodVoucherIndex === -1) {
        nextPeriodVoucherIndex = voucherEntryList.length;
      }
      const currentBalance = voucherEntryList[nextPeriodVoucherIndex-1].balance;
      
      const yearResult = await jianghuKnex(tableEnum.view01_voucher_entry, this.ctx)
        .whereRaw('? <= periodId', [firstPeriodIdOfFinanceYear])
        .whereRaw('periodId <= ?', [currentPeriodId])
        .where({ subjectId, ...assistIdWhere })
        .select(jianghuKnex.raw('sum(debit) as debit, sum(credit) credit'));
      const endDebit = yearResult[0].debit || 0;
      const endCredit = yearResult[0].credit || 0;
      voucherEntryList.splice(nextPeriodVoucherIndex, 0, {
        voucherAt: dayjs(currentPeriodId).endOf('month').format('YYYY-MM-DD'),
        entryAbstract: '本年累计',
        debit: endDebit,
        credit: endCredit,
        subjectBalanceDirection: endDebit-endCredit? subjectBalanceDirection: '平',
        balance: currentBalance,
      });

      const voucherEntryListCurrent = voucherEntryList.filter(ve => ve.voucherId && ve.periodId == currentPeriodId);
      const currentDebit = _.sumBy(voucherEntryListCurrent, 'debit') || 0;
      const currentCredit = _.sumBy(voucherEntryListCurrent, 'credit')|| 0;
      voucherEntryList.splice(nextPeriodVoucherIndex, 0, {
        voucherAt: dayjs(currentPeriodId).endOf('month').format('YYYY-MM-DD'),
        entryAbstract: '本期合计',
        debit: currentDebit,
        credit: currentCredit,
        subjectBalanceDirection: currentDebit-currentCredit? subjectBalanceDirection: '平',
        balance: currentBalance,
      });
    }

    return { rows: voucherEntryList };
  }

  async getItemListOfAuxiliaryBalanceSheet(actionData) {
    const { jianghuKnex } = this.app;
    validateUtil.validate(actionDataScheme.getItemListOfAuxiliaryBalanceSheet, actionData);
    const { periodIdList, subjectId, assistType } = actionData;
    const endPeriodId = periodIdList[0];
    const startPeriodId = periodIdList[periodIdList.length - 1];
    const period = await jianghuKnex(tableEnum.period, this.ctx).where({ periodId: startPeriodId }).select().first();
    const firstPeriodIdOfFinanceYear = `${period.financeYear}-00`;

    // 科目余额方向
    const subjectBalanceList = await jianghuKnex(tableEnum.view01_subject_balance_period, this.ctx)
      .where({ subjectId })
      .whereIn('periodId', periodIdList)
      .orderBy('periodId', 'desc')
      .select();

    const subjectBalanceListOfFinanceYear = await jianghuKnex(tableEnum.view01_subject_balance_period, this.ctx)
      .where({ subjectId })
      .whereRaw('? <= periodId', [firstPeriodIdOfFinanceYear])
      .whereRaw('periodId <= ?', [endPeriodId])
      .orderBy('periodId', 'desc')
      .select();
      
    const subjectBalancePeriodStart = subjectBalanceList[subjectBalanceList.length - 1];
    const subjectBalancePeriodEnd = subjectBalanceList[0];
    const { subjectBalanceDirection } = subjectBalancePeriodStart;

    // 辅助项目列表
    const assistIdKey = `assistIdOf${_.capitalize(assistType)}`;
    const assistNameKey = `assistNameOf${_.capitalize(assistType)}`;
    const whereRawSubjectId = `subjectId like '${subjectId}%'`;
    const assistList = await jianghuKnex(`assist_${assistType}`, this.ctx).select();

    // 计算上一个会计期间余额
    const prePeriodResult = await jianghuKnex(tableEnum.view01_voucher_entry, this.ctx)
      .whereRaw('periodId < ?', [startPeriodId])
      .whereRaw(whereRawSubjectId)
      .groupBy('assistId')
      .select(jianghuKnex.raw(`if(${assistIdKey} is null, '', ${assistIdKey}) as assistId, 
      ${assistNameKey} as assistName, sum(debit) as debit, sum(credit) credit`));
    const prePeriodDataMap = _.keyBy(prePeriodResult, 'assistId');
    prePeriodResult.forEach(assistTemp => {
      const { assistId, assistName } = assistTemp
      if (assistList.findIndex(assist => assist.assistId === assistId) === -1) {
        assistList.push({ assistId, assistName });
      }
    })
    
    // 计算当前会计期间余额
    const currentPeriodResult = await jianghuKnex(tableEnum.view01_voucher_entry, this.ctx)
      .where("periodId", "in", periodIdList)
      .whereRaw(whereRawSubjectId)
      .groupBy('assistId')
      .select(jianghuKnex.raw(`if(${assistIdKey} is null, '', ${assistIdKey}) as assistId, 
      ${assistNameKey} as assistName, sum(debit) as debit, sum(credit) credit`));   
    const currentPeriodDataMap = _.keyBy(currentPeriodResult, 'assistId');
    currentPeriodResult.forEach(assistTemp => {
      const { assistId, assistName } = assistTemp
      if (assistList.findIndex(assist => assist.assistId === assistId) === -1) {
        assistList.push({ assistId, assistName });
      }
    })

    // 计算本年发生额
    const yearResult = await jianghuKnex(tableEnum.view01_voucher_entry, this.ctx)
      .whereRaw('? <= periodId', [firstPeriodIdOfFinanceYear])
      .whereRaw('periodId <= ?', [endPeriodId])
      .whereRaw(whereRawSubjectId)
      .groupBy('assistId')
      .select(jianghuKnex.raw(`if(${assistIdKey} is null, '', ${assistIdKey}) as assistId, 
      ${assistNameKey} as assistName, sum(debit) as debit, sum(credit) credit`));  
    const yearPeriodDataMap = _.keyBy(yearResult, 'assistId');
    
    const assistBalanceList = assistList.map(assit => {
      const { assistId, assistName } = assit;
      const prePeriodData = prePeriodDataMap[assistId] || { debit: 0, credit: 0};
      const currentPeriodData = currentPeriodDataMap[assistId] || { debit: 0, credit: 0};
      const yearData = yearPeriodDataMap[assistId] || { debit: 0, credit: 0};
      let startDebit, startCredit, occurDebit, occurCredit, occurDebitYear, occurCreditYear, endDebit, endCredit = 0;
      occurDebit = currentPeriodData.debit;
      occurCredit = currentPeriodData.credit;
      occurDebitYear = yearData.debit;
      occurCreditYear = yearData.credit;

      if (subjectBalanceDirection === '借') {
        startDebit = prePeriodData.debit-prePeriodData.credit;
        startCredit = 0;
        endDebit = startDebit + (currentPeriodData.debit-currentPeriodData.credit);
        endCredit = 0;
      }

      if (subjectBalanceDirection === '贷') {
        startDebit = 0;
        startCredit = prePeriodData.credit-prePeriodData.debit;
        endDebit = 0;
        endCredit = startCredit + (currentPeriodData.credit-currentPeriodData.debit);
      }
      return {
        assistId, assistName: assistId ? assistName : '无辅助信息', subjectBalanceDirection,
        startDebit, startCredit, 
        occurDebit, occurCredit, 
        occurDebitYear, occurCreditYear,
        endDebit, endCredit
      }
    })
    assistBalanceList.push({});

    // const previouList = subjectBalanceListOfFinanceYear
    //   .filter(sbp => sbp.subjectId === subjectId)
    //   .filter(sbp => sbp.periodId <= endPeriodId);
    // TODO: 直接取科目的合计 因为科目包含1-6月的数据
    assistBalanceList.push({
      assistId: `合计`, assistName: `${subjectBalancePeriodStart.subjectId} ${subjectBalancePeriodStart.subjectName}`, subjectBalanceDirection,
      startDebit: subjectBalancePeriodStart.startDebit, 
      startCredit: subjectBalancePeriodStart.startCredit, 
      occurDebit: _.sumBy(subjectBalanceList, 'occurDebit'), 
      occurCredit: _.sumBy(subjectBalanceList, 'occurCredit'), 
      occurDebitYear: _.sumBy(assistBalanceList, 'occurDebitYear'),
      occurCreditYear: _.sumBy(assistBalanceList, 'occurCreditYear'),
      endDebit: subjectBalancePeriodEnd.endDebit, 
      endCredit: subjectBalancePeriodEnd.endCredit,
    })
    return { rows: assistBalanceList };
  }

  async getItemListOfSubjectBalance(actionData) {
    const { jianghuKnex } = this.app;
    validateUtil.validate(actionDataScheme.getItemListOfSubjectBalance, actionData);
    const { periodIdList } = actionData;
    const startPeriodId = periodIdList[periodIdList.length - 1];
    const endPeriodId = periodIdList[0];
    const period = await jianghuKnex(tableEnum.period, this.ctx).where({ periodId: startPeriodId }).select().first();
    const firstPeriodIdOfFinanceYear = `${period.financeYear}-01`;

    const subjectBalancePeriodList = await jianghuKnex(tableEnum.view01_subject_balance_period, this.ctx)
      .where("periodId", "in", periodIdList)
      .orderBy('subjectId', 'asc')
      .select();
    const subjectBalancePeriodListOfFinanceYear = await jianghuKnex(tableEnum.view01_subject_balance_period, this.ctx)
      .whereRaw('? <= periodId', [firstPeriodIdOfFinanceYear])
      .whereRaw('periodId <= ?', [endPeriodId])
      .orderBy('subjectId', 'asc')
      .select();  

    const rows = await this.mergeSubjectBalanceMultiplePeriodData(subjectBalancePeriodList);

    rows.forEach(row => {
      const { subjectId } = row;
      const previouList = subjectBalancePeriodListOfFinanceYear
        .filter(sbp => sbp.subjectId == subjectId)
        .filter(sbp => sbp.periodId <= endPeriodId);
      row.occurDebitYear = _.sumBy(previouList, 'occurDebit');
      row.occurCreditYear = _.sumBy(previouList, 'occurCredit');
      row.endAmountYear = row.endAmount;
    });
    
    const sortedRows = _.sortBy(rows, ['subjectId']);

    return { rows: sortedRows };
  }
}

module.exports = AccountService;