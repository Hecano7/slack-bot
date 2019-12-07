import moment from "moment";


function mergeStudentData(studentStandupsAndCheckins) {
  let mergedData = {};
  const checkins = studentStandupsAndCheckins[1].value;
  for (let i = 0; i < checkins.length; i++) {
    const formattedDate = moment(checkins[i].checkin_time).format("L dddd");
    if (!mergedData[formattedDate]) {
      mergedData[formattedDate] = {};
    }
    mergedData[formattedDate]["checkin"] = checkins[i];
  }

  const standups = studentStandupsAndCheckins[0].value;
  for (let i = 0; i < standups.length; i++) {
    const formattedDate = moment(standups[i].date).format("L dddd");
    if (!mergedData[formattedDate]) {
      mergedData[formattedDate] = {};
    }
    mergedData[formattedDate]["standup"] = standups[i];
  }

  return mergedData;
}

function getStudentStats(id, authToken, slack_id) {
  return dispatch => {

    const standups = dispatch({
      type: "GET_STUDENT_STANDUPS",
      payload: fetch(`/api/students/${id}/standups?access_token=${authToken}`)
        .then(response => response.json())
        .then(standups => {
          return standups;
        })
    });

    const checkins = dispatch({
      type: "GET_STUDENT_CHECKINS",
      payload: fetch(
        `/api/checkins/slackId/${slack_id}?access_token=${authToken}`
      )
        .then(response => response.json())
        .then(checkins => {
          return checkins;
        })
    });

    const wakatimeFilter = JSON.stringify({
      where: {
        slack_id: slack_id
      }
    });

    dispatch({
      type: "GET_STUDENT_WAKATIMES",
      payload: fetch(
        `/api/wakatimes/?access_token=${authToken}&filter=${wakatimeFilter}`
      )
        .then(response => response.json())
        .then(wakatimes => {
          return wakatimes;
        })
    });

    Promise.all([standups, checkins]).then(standupsAndCheckins =>
      dispatch({
        type: "GET_STANDUPS_AND_CHECKINS",
        payload: mergeStudentData(standupsAndCheckins)
      })
    );
  };
}

export function getStudentInfo(id, authToken) {
  return dispatch => {
    return dispatch({
      type: "GET_STUDENT_INFO",
      payload: fetch(`/api/students/${id}?access_token=${authToken}`)
        .then(response => response.json())
        .then(data => {
          return data;
        })
    }).then(student => {
      dispatch(getStudentStats(id, authToken, student.value.slack_id));
    });
  };
}

export function updateStudentInfo(id, editedStudentInfo, authToken) {
  return dispatch => {
    fetch(`/api/students/${id}?access_token=${authToken}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(editedStudentInfo)
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          dispatch({
            type: "GET_EDIT_ERROR",
            payload: data.error.message
          });
        } else {
          dispatch({
            type: "UPDATE_STUDENT_INFO",
            payload: data
          });
        }
      });
  };
}

export function toggleEditWindow(isOpen) {
  return dispatch => {
    dispatch({
      type: "TOGGLE_EDIT_WINDOW",
      payload: isOpen
    });
  };
}
