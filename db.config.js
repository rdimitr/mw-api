const configOra = {
             user          : "medbase",
             password      : "medbrat",
             connectString : "192.168.0.105/MNTK"
        };

const configMSSQL = {
            user: 'sa',
            password: 'Sasasa_1',
            server: '192.168.0.142', 
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