const Service = require('egg').Service;
const _ = require('lodash');
const dayjs = require('dayjs');
const { tableEnum } = require('../constant/constant');
const { BizError, errorInfoEnum } = require('../constant/error');

class FundAccountTransferEntryService extends Service {
  async createFundAccountEntryAfterHook(){
    const { actionData } = this.ctx.request.body.appData
    const { transferAbstract, amount, fromAccountId, toAccountId, remark } = actionData

    const batchInsertFundAccountEntryData = [{
      accountId: fromAccountId,
      accountEntryAbstract: transferAbstract,
      templateName: "内部转账",
      accountEntryAt: dayjs().format("YYYY-MM-DD"),
      amount: -amount,
      transferAccountInfo: JSON.stringify({ fromAccountId, toAccountId, remark }),
    },{
      accountId: toAccountId,
      accountEntryAbstract: transferAbstract,
      templateName: "内部转账",
      accountEntryAt: dayjs().format("YYYY-MM-DD"),
      amount: amount,
      transferAccountInfo: JSON.stringify({ fromAccountId, toAccountId, remark }),
    }];

    this.ctx.service.fundAccountEntry.batchInsertFundAccountEntryData(batchInsertFundAccountEntryData)
  }

  async relVoucherIdAfterHook(){
    const { jianghuKnex } = this.app
    const { actionData } = this.ctx.request.body.appData
    const { ticketList, voucherNewId } = actionData
    const fundAccountTransferEntryInfo = ticketList[0];

    if (!fundAccountTransferEntryInfo.transferId || !voucherNewId) {
      throw new BizError(errorInfoEnum.data_exception);
    };
    await jianghuKnex(tableEnum.fund_account_transfer_entry, this.ctx).where({ transferId: fundAccountEntryInfo.transferId }).update({voucherId: voucherNewId});
  }

  async importFundAccountTransferEntryData(){
    const { jianghuKnex } = this.app
    const { importData } = this.ctx.request.body.appData.actionData

    if (_.isEmpty(importData)) {
      throw new BizError(errorInfoEnum.data_exception);
    };

    const idSequence = await jianghuKnex(tableEnum.fund_account_transfer_entry, this.ctx).max('idSequence', { as: "idSequence" }).first();
    for (const importItem of importData) {
      await jianghuKnex.transaction(async trx => {
        importItem.idSequence = idSequence++;
        importItem.transferId = `ZZ${importItem.idSequence}`;
        importItem.operationAt = new Date();

        const { transferAbstract, amount, fromAccountId, toAccountId, remark } = importItem;
        await trx(tableEnum.fund_account_transfer_entry, this.ctx).insert(importItem);

        const batchInsertFundAccountEntryData = [{
          accountId: fromAccountId,
          accountEntryAbstract: transferAbstract,
          templateName: "内部转账",
          relTransferId: importItem.transferId,
          accountEntryAt: dayjs().format("YYYY-MM-DD"),
          amount: -amount,
          transferAccountInfo: JSON.stringify({ fromAccountId, toAccountId, remark }),
        },{
          accountId: toAccountId,
          accountEntryAbstract: transferAbstract,
          templateName: "内部转账",
          relTransferId: importItem.transferId,
          accountEntryAt: dayjs().format("YYYY-MM-DD"),
          amount: amount,
          transferAccountInfo: JSON.stringify({ fromAccountId, toAccountId, remark }),
        }];
        this.ctx.service.fundAccountEntry.batchInsertFundAccountEntryData(batchInsertFundAccountEntryData)
      });
    }
  }
}

module.exports = FundAccountTransferEntryService;