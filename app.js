var express = require('express');
var app = express();

var bodyParser = require('body-parser');

var sql = require("mssql");
var oracledb = require('oracledb');

var constants = require('./db.config');

const cors = require('cors')
app.use(cors());


function modifyDate(inputDate) {
    function addLeadZero(val, zeroCount) {
              switch (zeroCount){
                      case 3: if (+val < 10) {return '00' + val;}
                              else if (+val < 100) {return '0' + val;}  
                              break;
                      case 2: if (+val < 10) return '0' + val; break;
              }
              return val;
    };

    var a = new Date(inputDate);
    var dateStr = [ addLeadZero(a.getDate(),2), addLeadZero(a.getMonth() + 1,2), a.getFullYear(),
              ].join('.') 
              + ' ' +
              [ addLeadZero(a.getHours(),2), addLeadZero(a.getMinutes(),2),  a.getSeconds(),
                addLeadZero(a.getMilliseconds(),3) 
              ]. join(':');

    return dateStr;
}



async function getOraData(iCard, res){

        let connectionOra = await oracledb.getConnection(constants.configOra);
        
        try {
            resORA = await connectionOra.execute(`SELECT id_in_mw_reestr FROM medbase.mw_docs_list_work WHERE nom_kart = :iCard` +
                                                 ` and id_mw_doc=6`, 
                                                 [iCard]);
            if (resORA.rows.length === 0) {
                await connectionOra.close();
                console.error("No results");
                res.send({ message: "Для номера карты " + iCard + " документы не найдены", error: 404 });
                return -1;
            }
            else {
                
                await connectionOra.close();
                
                console.log(resORA);

                await getSQLData(resORA.rows, res);
                
                return 0; 
            }
        } catch (e) {
            console.error(e);
            return -1;
        }
}

async function getSQLData(docsMW, res){
    
        sql.connect(constants.configMSSQL, function (err) {
    
        if (err) {
             console.log(err);
             res.send({ message: "Ошибка соединения с MQ SQL", error: 500 });
        }

        let request = new sql.Request(); 
        let sQuery = 'select tsk_state.status_date, tsk_state.egiszAction, tsk_state.statusID, state_dict.NameStatus ' + 
                     'from MedworkData.dbo.egiszTasks as tsk ' +
                     'left outer join MedworkData.dbo.egiszTaskStatus as tsk_state on tsk_state.MasterID = tsk.ID ' +
                     'left outer join MedworkData.dbo.egiszTaskStatusDict as state_dict on state_dict.ID = tsk_state.statusID ' +
                     'where tsk.mw_id in (' + docsMW.join(',') + ') ' +
                     'and tsk_state.statusID in (1,2,3,4,5,6,10) order by 1';

        request.query(sQuery)
               .then(data => {
                        console.log('Request ok...');
                        data.recordset.forEach( (item, i)=>{
                             data.recordset[i].status_date = modifyDate(data.recordset[i].status_date);
                        });
                        res.send(JSON.stringify(data.recordset));
               })
               .then(()=>sql.close())
               .catch(error => {
                        console.error(error);
                        res.send({ message: "Error execute SQL script...", error: 500 });
               })
        });
}


app.get('/status/:idcard', function (req, res) {
    let iCard = req.params.idcard;

    if (iCard > 0) {
        let iCardMW = getOraData(iCard, res);
    };
});


var server = app.listen(5050, function () {
    console.log('Server is running.. Port ' + server.address().port);
});