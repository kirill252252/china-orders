// Обёртка для асинхронных обработчиков Express.
// Пробрасывает ошибки в next(), чтобы работал глобальный errorHandler.
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
