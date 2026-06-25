export interface MockedRoom {
  _id: string;
  name: string;
  category: string;
  capacity: number;
  reserved: number;
  color: string;
}

const mockedRooms: MockedRoom[] = [
  {
    _id: "690630251892b5b465716584",
    name: "Administration",
    category: "6906d3ea5b186aa8eba9e453",
    capacity: 4,
    reserved: 0,
    color: "#f15d5d",
  },
  {
    _id: "690632f14dfbda81a8a5cd61",
    name: "Management",
    category: "6906d4085b186aa8eba9e456",
    capacity: 4,
    reserved: 0,
    color: "#f4d01f",
  },
  {
    _id: "690633864dfbda81a8a5cd76",
    name: "Blue Room",
    category: "6906d3985b186aa8eba9e440",
    capacity: 8,
    reserved: 1,
    color: "#3893f4",
  },
  {
    _id: "690633224dfbda81a8a5cd67",
    name: "Euro USC",
    category: "6906d4365b186aa8eba9e459",
    capacity: 4,
    reserved: 0,
    color: "#39e1a0",
  },
  {
    _id: "690633684dfbda81a8a5cd70",
    name: "Green Room",
    category: "6906d3985b186aa8eba9e440",
    capacity: 8,
    reserved: 1,
    color: "#4bd710",
  },
  {
    _id: "6906334b4dfbda81a8a5cd6d",
    name: "Red Room",
    category: "6906d3985b186aa8eba9e440",
    capacity: 8,
    reserved: 2,
    color: "#f12323",
  },
];

export default mockedRooms;
