const configOra = {
             user          : "xxxx",
             password      : "xxxx",
             connectString : "192.168.0.105/MNTK"
        };



const configMSSQL = {
            user: 'xx',
            password: 'xxxxx_1',
            server: '192.168.0.142', 
            database: 'MedworkData',
            options: {
               encrypt: false,
               trustServerCertificate: true
            } 
        };
        
module.exports = {configOra, configMSSQL};
