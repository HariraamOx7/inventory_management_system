module.exports = error => {
  if (error.statusCode || error.status) return error.statusCode || error.status;
  if (['SequelizeUniqueConstraintError', 'SequelizeForeignKeyConstraintError'].includes(error.name)) return 409;
  if (error.name === 'SequelizeValidationError') return 400;
  return 500;
};
