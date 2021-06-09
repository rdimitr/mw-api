const configOra = {
             user          : "xxxx",
             password      : "xxxx",
             connectString : "192.168.0.xxx/MNTK"
        };

const configMSSQL = {
            user: 'sa',
            password: 'xxxxx',
            server: '192.168.0.xxx', 
            database: 'MedworkData',
            options: {
               encrypt: false,
               trustServerCertificate: true
            } 
        };

const chunkINexpression = 500;
const renewalInterval = 30000;   // Интервал обновления статусов документов, миллисекунды. 0 - не обновлять
const docsTimeSlotInterval = 60; // Окно сканирования для времени обновления статусов документов, минуты. 
                                 // От (тек.даты-docsTimeSlotInterval) до (тек.даты)
        
module.exports = {configOra, configMSSQL, chunkINexpression, renewalInterval, docsTimeSlotInterval};
