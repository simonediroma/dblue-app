export interface MockedClosure {
  _id: string;
  motivation: string;
  start: string;
  end: string;
  range: string[];
}

const mockedClosures: MockedClosure[] = [
  {
    _id: "6911ffaa94c73cc2fd90c9c3",
    motivation: "maintenance",
    start: "09-11-2025",
    end: "10-11-2025",
    range: ["09-11-2025", "10-11-2025"],
  },
  {
    _id: "6a3951da92383aefa2cdb3c2",
    motivation: "office_closure",
    start: "01-08-2026",
    end: "23-08-2026",
    range: ["01-08-2026", "23-08-2026"],
  },
];

export default mockedClosures;
