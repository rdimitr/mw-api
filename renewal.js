var constants = require('./db.config');
var oracledb = require('oracledb');
var sql = require("mssql");
var listdocs = require("./listdocs.js");

var retMSSQL = [];

async function callProcessUpdate(fillAllDocs, res) {
        setMSSQLdocstatus(fillAllDocs, async function() {
            let connectionOra = await oracledb.getConnection(constants.configOra);
            for (let i=0; i<retMSSQL.length; i++){ 
                let updOraStr = `UPDATE medbase.mw_docs_list_work SET status_id=` + retMSSQL[i].status_id + 
                                `, status_date = TO_TIMESTAMP(\'` + retMSSQL[i].status_date + 
                                `\', \'DD.MM.YYYY HH24:MI:SS:FF9\') WHERE id_in_mw_reestr=` + retMSSQL[i].mw_id + ` and id_mw_doc = 6`;
                connectionOra.execute(updOraStr, (error, result)=>{
                    if (error) {
                        console.log(error);
                   } else {
                        console.log(result);
                        connectionOra.commit();
                   };
                });
            };
        });
};

async function setMSSQLdocstatus(fillAllDocs, callback){
    sql.connect(constants.configMSSQL, function (err) {

        if (err) {
            console.log(err);
        }
        retMSSQL = [];
        let request = new sql.Request(); 
        let sQuery = makeMSSQLstring(fillAllDocs);

        request.query(sQuery)
        .then(data => {
                console.log("Запрос выполнен в ", Date(), ", для обновления записей - ", data.recordset.length);
                data.recordset.forEach( (item, i)=>{ 
                    item.status_date = listdocs.modifyDate(item.status_date);
                });
                retMSSQL = data.recordset;
                callback();
        })
        .catch(error => {
                console.error(error);
                res.send({ message: "Error execute SQL script...", error: 500 });
        })
    })
}


function makeMSSQLstring(fillAlldocs){
    let sQuery = `select sub_sql.mw_id, lst_st.StatusID as status_id, lst_st.status_date  from (
                SELECT task.mw_id, max(task_status.ID) AS stID FROM "MedworkData"."dbo"."egiszTasks" AS task
                left outer JOIN "MedworkData"."dbo"."egiszTaskStatus" task_status ON (task.ID = task_status.masterID)
                WHERE task.mw_id IS NOT NULL 
                `; 
    let substrAllDates = ` and task_status.status_date between '2020-01-01 00:00:01.000' and GETDATE() `;
    let substrCurrDates = ` and task_status.status_date between DATEADD(MI, -:TIME_SLOT_INTERVAL, GETDATE()) and GETDATE()`;
    let endSQLstring = ` GROUP BY task.mw_id
                       ) as sub_sql
                       left outer join "MedworkData"."dbo"."egiszTaskStatus" as lst_st on (lst_st.ID = sub_sql.stID)`;

    if (fillAlldocs) {
        sQuery = sQuery + substrAllDates + endSQLstring;
    } else {
        sQuery = sQuery + listdocs.replaceAll(substrCurrDates, ":TIME_SLOT_INTERVAL", constants.docsTimeSlotInterval) + endSQLstring;
    }

    return sQuery;
}


module.exports.getMSSQLdocstatus = setMSSQLdocstatus;
module.exports.callProcessUpdate = callProcessUpdate;