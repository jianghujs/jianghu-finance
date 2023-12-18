'use strict';

const { createJianghuKnex } = require('./app/common/jianghuKnexUtil');


class AppBootHook {
  constructor(app) {
    this.app = app;
  }

  configDidLoad() {
    // 挂载jianghuKnex
    const { ignoreTableListOfAppaId=[] } = this.app.config.jianghuConfig
    const knex = this.app.knex;
    this.app.jianghuKnex = createJianghuKnex({ knex, ignoreTableListOfAppaId });
  }

  async serverDidReady() {
  }

}

module.exports = AppBootHook;

