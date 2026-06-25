export interface MockedRoomCategory {
  _id: string;
  category: string;
  bgcolor: string;
  color: string;
}

const mockedRoomCategories: MockedRoomCategory[] = [
  {
    _id: "6906d3985b186aa8eba9e440",
    category: "Open Space",
    bgcolor: "#59c1dc",
    color: "#ffffff",
  },
  {
    _id: "6906d3ea5b186aa8eba9e453",
    category: "Administration",
    bgcolor: "#f96868",
    color: "#ffffff",
  },
  {
    _id: "6906d4085b186aa8eba9e456",
    category: "Management",
    bgcolor: "#f9d90c",
    color: "#000000",
  },
  {
    _id: "6906d4365b186aa8eba9e459",
    category: "Euro USC",
    bgcolor: "#0cdea9",
    color: "#000000",
  },
];

export default mockedRoomCategories;
