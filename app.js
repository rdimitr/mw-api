var express = require('express');
var app = express();

app.use(express.json());

var sql = require("mssql");
var oracledb = require('oracledb');

var constants = require('./db.config');
var listdocs = require("./listdocs.js");
var renewal = require('./renewal.js');

const cors = require('cors')
app.use(cors());


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
                        // Приведение даты к формату DD:MM:YYYY HH:MM:SS:MS
                        data.recordset.forEach( (item, i)=>{
                             data.recordset[i].status_date = listdocs.modifyDate(data.recordset[i].status_date);
                        });
                        res.send(JSON.stringify(data.recordset));
               })
               .then(()=>sql.close())
               .catch(error => {
                        console.error(error);
                        res.send({ message: "Ошибка выполнения MS SQL скрипта...", error: 500 });
               })
        });
}


app.get('/status/:idcard', function (req, res) {
    let iCard = req.params.idcard;

    if (iCard > 0) {
        let iCardMW = getOraData(iCard, res);
    };
});


app.get('/listdocs', function (req, res) {
    //let reqbody = req.body;
    let dateBegin, dateEnd, lstStat, lstAuthor;

    if (!('beginInterval' in req.body) ||  !('endInterval' in req.body)) 
                 {
                   dateBegin = listdocs.createCurrentDate(true);
                   dateEnd  = listdocs.createCurrentDate(false);
                }
                else {
                    if (req.body.beginInterval) {
                       dateBegin = req.body.beginInterval;
                    } else {
                       dateBegin = listdocs.createCurrentDate(true); 
                    };
                    if (req.body.endInterval) {
                        dateEnd = req.body.endInterval;
                    }
                    else {
                        dateEnd  = listdocs.createCurrentDate(false);
                    }
                };
    if ('listStatus' in req.body) {
         if (req.body.listStatus.length > 0) {lstStat = req.body.listStatus} else {lstStat = null}
    }  else {
         lstStat = null;
    }

    if ('listDoctor' in req.body) {
         if (req.body.listDoctor.length > 0) {lstAuthor = req.body.listDoctor} else {lstAuthor = null}
    } else {
        lstAuthor = null;
    }
    
    var listOra = listdocs.getListDocs(dateBegin, dateEnd, lstStat, lstAuthor, res)
});


app.get('/monitor', function (req, res) {
   renewal.callProcessUpdate(true);
   res.send({ message: "Данные по статусам документов за весь период обновлены успешно", error: 200 });
});


var server = app.listen(5050, function () {
    console.log('Server is running.. Port ' + server.address().port);
});


if (constants.renewalInterval > 0){
    var timer = setInterval(function (){ renewal.callProcessUpdate(false); }, constants.renewalInterval);
};