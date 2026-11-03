// Vercel 서버리스 API에서 받은 에어코리아 정보를 화면에 표시합니다.
const regionSelect = document.querySelector("#region-select");
const selectedRegion = document.querySelector("#selected-region");
const airStatus = document.querySelector("#air-status");
const statusEmoji = document.querySelector("#status-emoji");
const statusLabel = document.querySelector("#status-label");
const airGuidance = document.querySelector("#air-guidance");
const averageValue = document.querySelector("#average-value");
const averageDescription = document.querySelector("#average-description");
const stationCount = document.querySelector("#station-count");
const statusMessage = document.querySelector("#status-message");
const stationList = document.querySelector("#station-list");
const chartContainer = document.querySelector("#chart-container");
const chartMessage = document.querySelector("#chart-message");
const chartCanvas = document.querySelector("#dust-chart");
let dustChart;

const gradeDetails = {
  "1": { label: "좋음", className: "grade-1", emoji: "🔵", color: "#e8f2ff" },
  "2": { label: "보통", className: "grade-2", emoji: "🟢", color: "#e8f6ec" },
  "3": { label: "나쁨", className: "grade-3", emoji: "🟠", color: "#fff1df" },
  "4": { label: "매우나쁨", className: "grade-4", emoji: "🔴", color: "#ffebeb" },
};
const unknownGradeColor = "#edf0f3";

function setAirStatus(grade, value, description) {
  const details = gradeDetails[grade];
  airStatus.className = `air-status ${details ? details.className : "is-unknown"}`;
  statusEmoji.textContent = details ? details.emoji : "⚪";
  statusLabel.textContent = details ? details.label : "측정 정보 없음";
  averageValue.textContent = value;
  airGuidance.textContent = grade === "3" || grade === "4"
    ? "외출 시 마스크를 챙기세요"
    : details
      ? "현재 대기질은 양호한 편입니다."
      : "대기질 정보를 확인할 수 없습니다.";
  averageDescription.textContent = description;
}

function getGradeFromAverage(value) {
  if (value <= 30) return "1";
  if (value <= 80) return "2";
  if (value <= 150) return "3";
  return "4";
}

function showStatus(message) {
  statusMessage.textContent = message;
  statusMessage.hidden = false;
}

function formatMeasurement(value) {
  if (value === "-" || value === null || value === undefined || String(value).trim() === "") {
    return "측정 안 됨";
  }
  return String(value);
}

function numericMeasurement(value) {
  if (value === "-" || value === null || value === undefined || String(value).trim() === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function createStationCard(station) {
  const grade = gradeDetails[String(station.pm10Grade || "").trim()];
  const card = document.createElement("article");
  card.className = `station-card ${grade ? grade.className : "grade-unknown"}`;

  const topLine = document.createElement("div");
  topLine.className = "card-topline";
  const name = document.createElement("h3");
  name.className = "station-name";
  name.textContent = station.stationName || "이름 없는 측정소";
  const badge = document.createElement("span");
  badge.className = "grade-badge";
  badge.textContent = grade ? grade.label : "등급 정보 없음";
  topLine.append(name, badge);

  const measurements = document.createElement("div");
  measurements.className = "measurements";
  measurements.append(
    createMeasurement("미세먼지", station.pm10Value),
    createMeasurement("초미세먼지", station.pm25Value),
  );

  const measuredAt = document.createElement("p");
  measuredAt.className = "measured-at";
  measuredAt.textContent = `측정 시각 · ${formatDataTime(station.dataTime)}`;
  card.append(topLine, measurements, measuredAt);
  return card;
}

function createMeasurement(label, value) {
  const wrapper = document.createElement("div");
  wrapper.className = "measurement";
  const measurementLabel = document.createElement("span");
  measurementLabel.className = "measurement-label";
  measurementLabel.textContent = label;
  const measurementValue = document.createElement("strong");
  measurementValue.className = "measurement-value";
  measurementValue.textContent = formatMeasurement(value);

  if (measurementValue.textContent !== "측정 안 됨") {
    const unit = document.createElement("small");
    unit.textContent = "㎍/㎥";
    measurementValue.append(unit);
  }

  wrapper.append(measurementLabel, measurementValue);
  return wrapper;
}

function formatDataTime(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):\d{2}/);
  if (!match) {
    return value ? `${value} 기준` : "정보 없음";
  }
  return `${match[1]}년 ${Number(match[2])}월 ${Number(match[3])}일 ${Number(match[4])}시 기준`;
}

function updateAverage(stations) {
  const values = stations
    .map((station) => numericMeasurement(station.pm10Value))
    .filter((value) => value !== null);

  if (values.length === 0) {
    setAirStatus("", "측정 안 됨", "평균을 계산할 수 있는 측정값이 없습니다.");
    return;
  }

  const average = values.reduce((total, value) => total + value, 0) / values.length;
  const formattedAverage = Number.isInteger(average) ? String(average) : average.toFixed(1);
  setAirStatus(
    getGradeFromAverage(average),
    formattedAverage,
    `측정값 ${values.length}개 기준 · 값이 없는 측정소는 평균에서 제외했습니다.`,
  );
}

function updateDustChart(stations) {
  const chartStations = stations
    .map((station) => ({
      name: station.stationName || "이름 없는 측정소",
      value: numericMeasurement(station.pm10Value),
      grade: gradeDetails[String(station.pm10Grade || "").trim()],
    }))
    .filter((station) => station.value !== null)
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  if (dustChart) {
    dustChart.destroy();
    dustChart = undefined;
  }

  if (chartStations.length === 0) {
    chartContainer.hidden = true;
    chartMessage.textContent = "그래프로 표시할 수 있는 미세먼지 측정값이 없습니다.";
    chartMessage.hidden = false;
    return;
  }

  if (typeof Chart === "undefined") {
    chartContainer.hidden = true;
    chartMessage.textContent = "그래프를 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.";
    chartMessage.hidden = false;
    return;
  }

  chartMessage.hidden = true;
  chartContainer.hidden = false;
  dustChart = new Chart(chartCanvas, {
    type: "bar",
    data: {
      labels: chartStations.map((station) => station.name),
      datasets: [{
        data: chartStations.map((station) => station.value),
        backgroundColor: chartStations.map((station) => station.grade?.color || unknownGradeColor),
        borderColor: chartStations.map((station) => station.grade?.color || unknownGradeColor),
        borderWidth: 1,
        borderRadius: 6,
        barPercentage: 0.72,
        categoryPercentage: 0.82,
      }],
    },
    options: {
      indexAxis: "y",
      maintainAspectRatio: false,
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => `${context.parsed.x} ㎍/㎥`,
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          title: { display: true, text: "미세먼지 (㎍/㎥)" },
        },
        y: {
          ticks: { autoSkip: false },
        },
      },
    },
  });
}

async function loadAirQuality(region) {
  selectedRegion.textContent = region;
  airStatus.className = "air-status is-loading";
  statusEmoji.textContent = "⏳";
  statusLabel.textContent = "불러오는 중...";
  averageValue.textContent = "--";
  airGuidance.textContent = "대기질 정보를 확인하고 있습니다.";
  averageDescription.textContent = "측정소 자료를 불러오고 있습니다.";
  stationCount.textContent = "";
  stationList.replaceChildren();
  chartContainer.hidden = true;
  chartMessage.textContent = "미세먼지 그래프를 불러오는 중...";
  chartMessage.hidden = false;
  showStatus("자료를 불러오고 있습니다.");

  try {
    const response = await fetch(`/api/dust?sido=${encodeURIComponent(region)}`);
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result?.message || `서버 응답 오류 (${response.status})`);
    }

    const body = result?.response?.body;
    if (result?.response?.header?.resultCode !== "00") {
      const message = result?.message || "API 요청에 실패했습니다.";
      throw new Error(message);
    }

    const stations = Array.isArray(body?.items) ? body.items : [];
    updateAverage(stations);
    updateDustChart(stations);
    stationCount.textContent = `총 ${stations.length}개 측정소`;
    if (stations.length === 0) {
      showStatus("선택한 지역의 측정소 자료가 없습니다.");
      return;
    }

    statusMessage.hidden = true;
    const cards = document.createDocumentFragment();
    stations.forEach((station) => cards.append(createStationCard(station)));
    stationList.append(cards);
  } catch (error) {
    setAirStatus("", "확인 불가", "대기질 정보를 가져오지 못했습니다.");
    chartContainer.hidden = true;
    chartMessage.textContent = "측정소 자료를 불러오지 못해 그래프를 표시할 수 없습니다.";
    chartMessage.hidden = false;
    showStatus(`자료를 불러오지 못했습니다. ${error.message}`);
  }
}

regionSelect.addEventListener("change", (event) => {
  loadAirQuality(event.target.value);
});

loadAirQuality(regionSelect.value);
