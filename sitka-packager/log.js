const winston = require('winston');
require('winston-daily-rotate-file');
const format = winston.format;
const { combine, timestamp, label, prettyPrint } = format;

var transport = new winston.transports.DailyRotateFile({
    filename: './logs/packager-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d',
    format: format.combine(format.uncolorize()),
});


const logConfiguration = {
    level: 'info',
    format: combine(
        winston.format.colorize(),
        winston.format.timestamp({format: 'YYYY-MM-DD HH:mm:ss'}),
        winston.format.align(),
        winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
    ),
    transports: [
        new (winston.transports.Console)({
        }),
        transport
    ]
};

const logger = winston.createLogger(logConfiguration);

module.exports=logger;