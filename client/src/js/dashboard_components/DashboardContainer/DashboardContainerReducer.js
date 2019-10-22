const defaultState = {
    students: [],
    studentsBeingViewed: [],
    allStandups: [],
    activeCheckins: []
};
export default function DashboardContainerReducer(state = defaultState, action) {
    const { type, payload } = action;
    switch (type) {
        case 'ADD_STUDENTS_TO_STORE': {
            return {
                ...state,
                students: payload
            };
        }

        case 'SAVE_STUDENT_DATA': {
            return {
                ...state,
                students: payload
            };
        }

        case 'SAVE_STUDENT_DATA_FULFILLED': {
            return {
                ...state,
                students: [...state.students, payload]
                }
        }

        case 'GET_STUDENT_DATA': {
            return {
                ...state,
                students: payload
            }
        }

        case 'GET_STUDENT_DATA_FULFILLED': {
            return {
                ...state,
                students: payload,
                studentsBeingViewed: payload.filter(student => student.type == 'PAID').concat(payload.filter(student => student.type == 'JOBSEEKER'))
            }
        }

        case 'SET_STUDENTS_BEING_VIEWED': {
            return {
                ...state,
                studentsBeingViewed: payload
            }
        }

        case 'GET_STANDUPS': {
                return {
                ...state,
                allStandups: payload
            }
        }

        case 'GET_CHECKINS': {
            return {
                ...state,
                activeCheckins: payload
        }
    }

        default: {
            return state;
        }
    }
}
