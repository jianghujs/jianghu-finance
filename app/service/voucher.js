const Service = require('egg').Service;
const idGenerateUtil = require("@jianghujs/jianghu/app/common/idGenerateUtil");
const validateUtil = require('@jianghujs/jianghu/app/common/validateUtil');
const { subjectCategoryEnum, tableEnum } = require('../constant/constant');
const { BizError, errorInfoEnum } = require('../constant/error');

const dayjs = require('dayjs');
require('dayjs/locale/zh-cn');
const localizedFormat = require('dayjs/plugin/localizedFormat');
dayjs.extend(localizedFormat);
dayjs.locale('zh-cn');

var Nzh = require("nzh");
var nzhcn = require("nzh/cn");

const _ = require("lodash");
const currency = require("currency.js");

const actionDataScheme = Object.freeze({
  selectNextVoucherNumber: {
    type: 'object',
    additionalProperties: true,
    required: ['periodId'],
    properties: {
      periodId: { type: 'string' },
    },
  },
  createVoucherAndVoucherEntry: {
    type: 'object',
    additionalProperties: true,
    required: ['voucherEntryList', 'periodId', 'voucherAt', 'voucherName', 'voucherNumber'],
    properties: {
      voucherEntryList: { type: 'array' },
      periodId: { type: 'string' },
      voucherAt: { type: 'string' },
      voucherName: { type: 'string' },
      voucherNumber: { anyOf: [{ type: "string" }, { type: "number" }] },
    },
  },

  updateVoucherAndVoucherEntry: {
    type: 'object',
    additionalProperties: true,
    required: ['id', 'voucherEntryList', 'periodId', 'voucherAt', 'voucherName', 'voucherNumber'],
    properties: {
      id: { anyOf: [{ type: "string" }, { type: "number" }] },
      voucherEntryList: { type: 'array' },
      periodId: { type: 'string' },
      voucherName: { type: 'string' },
      voucherNumber: { anyOf: [{ type: "string" }, { type: "number" }] },
      voucherAt: { type: 'string' },
    },
  },

  removeVoucher: {
    type: 'object',
    additionalProperties: true,
    required: ['voucherId'],
    properties: {
      voucherId: { anyOf: [{ type: "string" }, { type: "number" }] },
    },
  },

});

class VoucherService extends Service {

  // 打印凭证
  async appendVoucherInfoPageBeforeHook() {
    const { jianghuKnex, config } = this.app;
    const { username } = this.ctx.userInfo;
    const { voucherId, appaId } = this.ctx.request.query;
    this.ctx.request.body.appData = {appaId};

    const voucherIds = _.split(voucherId, ',');
    const voucherList = await jianghuKnex(tableEnum.voucher, this.ctx).whereIn('voucherId', voucherIds).select();
    const voucherEntry = await jianghuKnex(tableEnum.view01_voucher_entry, this.ctx).whereIn('voucherId', voucherIds).select();
    const voucherEntryGroup = _.groupBy(voucherEntry, 'voucherId');

    const voucherInfo = _.map(voucherList, voucher => {
      const entry = voucherEntryGroup[voucher.voucherId];
      const entryFormat = _.map(entry, item => {
        const { debit, credit } = item;
        return {
          ...item,
          debit: debit > 0 ? currency(debit, { symbol: '', decimal: '.', separator: ',' }).format() : '',
          credit: credit > 0 ? currency(credit, { symbol: '', decimal: '.', separator: ',' }).format() : ''
        }
      })
      const totalDebit = _.sumBy(entry, 'debit');
      const totalCredit = _.sumBy(entry, 'credit');
      const voucherEntryChunk = _.chunk(entryFormat, 5);
      const voucherEntryPadded = _.map(voucherEntryChunk, item => _.times(5, index => item[index] || {}));
      const record = {
        ...voucher,
        voucherEntry: entryFormat,
        voucherEntryChunk,
        voucherEntryPadded,
        pageTotal: voucherEntryChunk.length,
        voucherFileCount: entry.length > 0 ? entry[0]['voucherFileCount'] : 0,
        totalDebit: currency(totalDebit, { symbol: '', decimal: '.', separator: ',' }).format(),
        totalCredit: currency(totalCredit, { symbol: '', decimal: '.', separator: ',' }).format(),
        totalCreditCN: nzhcn.encodeB(totalCredit),
        voucherAt: dayjs(voucher.voucherAt).format('LL'),
        documentCreator: username,
      };
      return record;
    })

    return voucherInfo;
  }

  async selectNextVoucherNumber(actionData) {
    const { jianghuKnex } = this.app;
    validateUtil.validate(actionDataScheme.selectNextVoucherNumber, actionData);
    const { periodId } = actionData;

    const maxVoucherNumberResult = await jianghuKnex(tableEnum.voucher, this.ctx)
      .where({ periodId })
      .max('voucherNumber', {
        as: "maxVoucherNumber",
      })
      .first();
    if (!maxVoucherNumberResult.maxVoucherNumber) {
      return { voucherNumber: 1 };
    }

    return { voucherNumber: maxVoucherNumberResult.maxVoucherNumber + 1 };
  }

  async createVoucherAndVoucherEntry(actionData) {
    const { jianghuKnex } = this.app
    const { username } = this.ctx.userInfo;
    validateUtil.validate(actionDataScheme.createVoucherAndVoucherEntry, actionData);
    // Tip: periodId 可能时未来 的会计期间
    let { voucherEntryList, periodId, voucherAt, voucherName, voucherNumber, voucherType} = actionData;
    voucherEntryList = voucherEntryList.filter(x => x.subjectId);

    const currentPeriod = await jianghuKnex(tableEnum.period, this.ctx).where({ isCheckout: '待结账' }).select().first();
    if (!currentPeriod) {
      throw new BizError(errorInfoEnum.period_not_exist);
    }
    if (currentPeriod.isCheckout === '已结账') {
      throw new BizError(errorInfoEnum.period_has_checkout);
    }

    const voucherId = `${periodId}-${voucherName}-${voucherNumber}`;
    const countResult = await jianghuKnex(tableEnum.voucher, this.ctx)
      .where({ voucherId })
      .count('voucherId as count');
    if (countResult[0].count > 0) {
      throw new BizError(errorInfoEnum.voucherId_exist);
    }
 
    const [assistData, assistList] = await Promise.all([
      this.service.assist.selectAssistList(),
      this.service.assist._getAssistList(),
    ])

    await jianghuKnex.transaction(async trx => {
      await trx(tableEnum.voucher, this.ctx).insert({
        voucherId, voucherName, voucherNumber,
        periodId, voucherAt, voucherAccountant: username,
        ...voucherType ? {voucherType} : {}
      });

      for (const voucherEntry of voucherEntryList) {
        voucherEntry.voucherId = voucherId;

        assistList.forEach(assist=> {
          const assistId = `assistIdOf${_.upperFirst(assist.value)}`;
    
          if (voucherEntry[assistId]) {
            const assistList = assistData[assist.text];
            const assistObj = assistList.find(v => v.assistId === voucherEntry[assistId]) || {};
              voucherEntry[`assistNameOf${_.upperFirst(assist.value)}`] = assistObj.assistName;
          }
        })
      }
      await trx(tableEnum.voucher_entry, this.ctx).insert(voucherEntryList);
    });

    // Warining: 计算当前会计期间(不是用户传入的会计期间);
    await this.ctx.service.period.computeSubjectBalance({ periodId: currentPeriod.periodId });

    actionData.voucherNewId = voucherId;
  }

  async updateVoucherAndVoucherEntry() {
    const { jianghuKnex } = this.app
    const { username } = this.ctx.userInfo;
    const { actionData } = this.ctx.request.body.appData
    validateUtil.validate(actionDataScheme.createVoucherAndVoucherEntry, actionData);
    // Tip: periodId 可能时未来 的会计期间
    const { voucherEntryList, voucherId: voucherIdOld,
            periodId, voucherName, voucherNumber,
            voucherAt, } = actionData;
    const voucherIdNew = `${periodId}-${voucherName}-${voucherNumber}`;

    const currentPeriod = await jianghuKnex(tableEnum.period, this.ctx).where({ isCheckout: '待结账' }).select().first();
    if (!currentPeriod) {
      throw new BizError(errorInfoEnum.period_not_exist);
    }
    if (currentPeriod.isCheckout === '已结账') {
      throw new BizError(errorInfoEnum.period_has_checkout);
    }

    if (voucherIdNew !== voucherIdOld) {
      const countResult = await jianghuKnex(tableEnum.voucher, this.ctx)
        .where({ voucherId: voucherIdNew })
        .count('voucherId as count');
      if (countResult[0].count > 0) {
        throw new BizError(errorInfoEnum.voucherId_exist);
      }
    }


    const [assistData, assistList] = await Promise.all([
      this.service.assist.selectAssistList(),
      this.service.assist._getAssistList(),
    ])

    await jianghuKnex.transaction(async trx => {
      await trx(tableEnum.voucher, this.ctx).where({ voucherId: voucherIdOld }).update({
        periodId, voucherName, voucherNumber, voucherId: voucherIdNew,
        voucherAt, voucherAccountant: username
      });
      await trx(tableEnum.voucher_entry, this.ctx).where({ voucherId: voucherIdOld }).delete();
      voucherEntryList.forEach(voucherEntry => {
        voucherEntry.voucherId = voucherIdNew;
        assistList.forEach(assist=> {
          const assistId = `assistIdOf${_.upperFirst(assist.value)}`;
    
          if (voucherEntry[assistId]) {
            const assistList = assistData[assist.text];
            const assistObj = assistList.find(v => v.assistId === voucherEntry[assistId]) || {};
              voucherEntry[`assistNameOf${_.upperFirst(assist.value)}`] = assistObj.assistName;
          }
        })
          
      });
      await trx(tableEnum.voucher_entry, this.ctx).insert(voucherEntryList);
    });

    // Warining: 计算当前会计期间(不是用户传入的会计期间);
    await this.ctx.service.period.computeSubjectBalance({ periodId: currentPeriod.periodId });
  }


  async removeVoucher() {
    const ctx = this.ctx;
    const { jianghuKnex } = this.app
    const { actionData } = this.ctx.request.body.appData
    validateUtil.validate(actionDataScheme.removeVoucher, actionData);
    const { voucherId } = actionData;

    const voucher = await jianghuKnex(tableEnum.voucher, this.ctx).where({ voucherId }).select().first();
    const { periodId } = voucher;
    if (!voucher) {
      throw new BizError(errorInfoEnum.voucher_not_exist)
    }
    const period = await jianghuKnex(tableEnum.period, this.ctx).where({ periodId }).select().first();
    if (!period || period.isCheckout !== '待结账') {
      throw new BizError(errorInfoEnum.period_has_checkout)
    }

    await jianghuKnex.transaction(async trx => {
      await trx(tableEnum.voucher, this.ctx).where({ voucherId }).delete();
      await trx(tableEnum.voucher_entry, this.ctx).where({ voucherId }).delete();
    });

    this.ctx.service.period.computeSubjectBalancePeriod({ periodId });
  }

  /**
   * 关联凭证id(生成完凭证后，更新凭证id到关联的业务表里)
   * @param {*} actionData
   */
  async relAccountEntryVoucherIdAfterHook(){
    const { jianghuKnex } = this.app
    const { actionData } = this.ctx.request.body.appData
    const { ticketList, voucherNewId } = actionData

    await jianghuKnex.transaction(async trx => {
      for (const entryInfo of ticketList) {
        if (!voucherNewId) continue;
        if (entryInfo.accountEntryId) {
          if (entryInfo.relTransferId) {
            await trx(tableEnum.fund_account_entry, this.ctx).where({ relTransferId: entryInfo.relTransferId }).update({voucherId: voucherNewId});
            await trx(tableEnum.fund_account_transfer_entry, this.ctx).where({ transferId: entryInfo.relTransferId }).update({voucherId: voucherNewId});
          } else {
            await trx(tableEnum.fund_account_entry, this.ctx).where({ accountEntryId: entryInfo.accountEntryId }).update({voucherId: voucherNewId});
          }
        } else if(entryInfo.transferId) {
          await trx(tableEnum.fund_account_transfer_entry, this.ctx).where({ transferId: entryInfo.transferId }).update({voucherId: voucherNewId});
          await trx(tableEnum.fund_account_entry, this.ctx).where({ relTransferId: entryInfo.transferId }).update({voucherId: voucherNewId});
        }
      }
    });
  }
}

module.exports = VoucherService;
