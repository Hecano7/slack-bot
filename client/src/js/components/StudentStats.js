import React, { Component } from 'react';
import { connect } from 'react-redux';
import StandupAndCheckin from './StandupAndCheckin';
import HamburgerNavigation from './HamburgerNavigation';
import DataSectionForStudentStats from './DataSectionForStudentStats';
import {
  calculateIndividualCheckinData,
  calculateIndividualStandupsData,
  calculateIndividualWakatimeData,
  calculateIndividualCommitData
} from '../utilities';
import EditStudent from './EditStudent';
import {
  getStudentInfo,
  updateStudentInfo,
  toggleEditWindow,
} from './studentStatsActions';
import StudentStatsDownload from './StudentStatsDownload';

class Standups extends Component {
  constructor(props) {
    super(props);
    this.state = {
      display: {},
    };
    this.saveStudentData = this.saveStudentData.bind(this);
    this.openEditWindow = this.openEditWindow.bind(this);
    this.closeEditWindow = this.closeEditWindow.bind(this);
  }

  componentDidMount() {
    const id = this.props.location.pathname.replace("/student-summary/", "");
    const { dispatch } = this.props;
    dispatch(getStudentInfo(id, this.props.authToken));
  }

  toggle(panel) {
    this.setState({
      display: {
        ...this.state.display,
        [panel]: !this.state.display[panel]
      }
    });
  }

  closeEditWindow(event, override) {
    if (event.target === event.currentTarget || override) {
      const { dispatch } = this.props;
      dispatch(toggleEditWindow(!this.props.editWindowOpen));
    }
  }

  openEditWindow() {
    const { dispatch } = this.props;
    dispatch(toggleEditWindow(!this.props.editWindowOpen));
  }

  saveStudentData(studentData) {
    const id = this.props.location.pathname.replace("/student-summary/", "");
    const { dispatch } = this.props;
    dispatch(updateStudentInfo(id, studentData, this.props.authToken));
  }

  render() {
    let StandupAndCheckinComponent;
    let standupsData = [];
    if (this.props.studentStandups.length) {
      standupsData = calculateIndividualStandupsData(
        this.props.studentStandups
      );
    }

    console.log("studentCommits",this.props);
    let commitData = [];
    // if (this.props.studentCommits) {
    //   commitData = 7;
    // }
  
    let checkinData = [];
    if (this.props.studentCheckins) {
      checkinData = calculateIndividualCheckinData(this.props.studentCheckins);
    }

    let wakatimeData = [];
    if (this.props.studentWakatimes) {
      wakatimeData = calculateIndividualWakatimeData(this.props.studentWakatimes);
      console.log("This WakaTime: ",this.props.studentWakatimes);
    }
    console.log("WakaTime Data: ",wakatimeData);

      
    if (Object.keys(this.props.studentStandupsAndCheckins).length > 0) {
      StandupAndCheckinComponent = Object.entries(
        this.props.studentStandupsAndCheckins
      )
        .sort(sortByDate)
        .map(data => (
          <StandupAndCheckin
            key={data[0]}
            date={data[0]}
            checkin={data[1].checkin}
            standup={data[1].standup}
          />
        ));
    } else {
      StandupAndCheckinComponent = (
        <div className="standup-card">
          {`${this.props.studentInfo.name} has not submitted any standups and has not checked in.`}
        </div>
      );
    }

    function sortByDate(a, b) {
      return a[0] < b[0] ? 1 : -1;
    }

    let editStudentWindow = null;
    if (this.props.editWindowOpen) {
      editStudentWindow = (
        <EditStudent
          studentData={this.props.studentInfo}
          closeWindow={() => this.closeEditWindow}
          save={this.saveStudentData}
          errorMessage={this.props.errMessage}
        />
      );
    }

    let keyMetrics = [];
    let keyClassMetrics = [];
    let keyStandupMetrics = [];
    let keyCodingMetrics = [];
    let keyCommitMetrics = [];

    if (!!checkinData) {
      keyClassMetrics = checkinData.filter(function (obj) {
        return (obj.footer == "Time in class past 7 days") || (obj.footer == "weekly auto-checkouts");
      });
    }

    // if (!!commitData) {
    //   keyCodingMetrics = commitData.filter(function (obj){
    //     return (obj.footer == "GitHub Commits for the past 7 days");
    //   });
    // }

    if (!!commitData) {
      keyCommitMetrics = [{featured: 3,
        footer: "Commits in the past 7 days",
        measurement: "commits"}];  
    }
    
    // if (!!wakatimeData) {
    //   keyCodingMetrics = wakatimeData.filter(function (obj) {
    //     return (obj.footer == "Time coding past 7 days");
    //   });
    // }

    if (!!standupsData) {
      keyStandupMetrics = standupsData.filter(function (obj) {
        return (obj.footer == "Standups completed past 7 days");
      });
    }

    keyMetrics = [
      ...keyClassMetrics,
      ...keyCodingMetrics,
      ...keyStandupMetrics,
      ...keyCommitMetrics
    ];

    let otherMetrics = [];
    let otherClassMetrics = [];
    let otherStandupMetrics = [];
    let otherCodingMetrics = [];
 

    if (!!checkinData) {
      otherClassMetrics = checkinData.filter(function (obj) {
        return (obj.footer == "Time in class weekly average") || (obj.footer == "Time in class total hours");
      });
    }

    if (!!wakatimeData) {
      otherCodingMetrics = wakatimeData.filter(function (obj) {
        return (obj.footer == "Time coding weekly average") || (obj.footer == "Time coding total hours");
      });
    }

    if (!!standupsData) {
      otherStandupMetrics = standupsData.filter(function (obj) {
        return (obj.footer == "Standups completed total hours");
      });
    }

    otherMetrics = [
      ...otherClassMetrics,
      ...otherCodingMetrics,
      ...otherStandupMetrics
    ];

    return (
      <>
        <HamburgerNavigation
          openStudentEditWindow={() => this.openEditWindow}
          auth_token={this.props.authToken}
        />
        {editStudentWindow}
        <div className="header-name">
          <h4>{this.props.studentInfo.name}</h4>
        </div>
        <main className="wrapper">
          <div className="data-section-container-grid">
            <DataSectionForStudentStats
              title="Key Metrics"
              data={keyMetrics}
              name={this.props.studentInfo.name}
            />
            <DataSectionForStudentStats
              title="Other Metrics"
              data={otherMetrics}
              name={this.props.studentInfo.name}
            />
            <StudentStatsDownload 
            title='Checkin Data' 
            checkinData={this.props.studentCheckins}
            standupData={this.props.studentStandups}
            wakatimeData={this.props.studentWakatimes}
            commitData={this.props.studentCommits}
            name={this.props.studentInfo.name}
            />
          </div>
          
          <section className="standupAndcheckin">
            <span
              className="section-label pointer"
              onClick={() => this.toggle("standups-panel")}
            >
              <h2>Standups and Checkins</h2>
            </span>
            <div
              className={`standup-container ${
                this.state.display["standups-panel"]
                  ? "toggleContent-hidden"
                  : ""
              }`}
            >
              {StandupAndCheckinComponent}
            </div>
          </section>
        </main>
      </>
    );
  }
}

function mapStoreToProps(store) {
  return {
    studentInfo: store.studentStats.studentInfo,
    studentStandups: store.studentStats.studentStandups,
    studentCheckins: store.studentStats.studentCheckins,
    studentWakatimes: store.studentStats.studentWakatimes,
    studentCommits: store.studentStats.studentCommits,
    studentStandupsAndCheckins: store.studentStats.studentStandupsAndCheckins,
    errMessage: store.studentStats.errMessage,
    editWindowOpen: store.studentStats.editWindowOpen,
    authToken: store.dashboard.authToken
  };
}

export default connect(mapStoreToProps)(Standups);
