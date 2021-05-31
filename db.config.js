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
        
module.exports = {configOra, configMSSQL};