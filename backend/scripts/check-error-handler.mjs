// Проверка обработчика ошибок: что клиент видит при внутренней ошибке.
import { errorHandler } from '../src/utils/errors.js';

function run(error) {
  const res = {
    headersSent: false,
    status(code) { this.code = code; return this; },
    set() { return this; },
    json(body) { console.log(this.code, JSON.stringify(body)); },
  };
  errorHandler(error, { method: 'GET', path: '/check', originalUrl: '/check', headers: {} }, res, () => {});
}

console.log('NODE_ENV =', process.env.NODE_ENV);
run(new Error('secret db text'));