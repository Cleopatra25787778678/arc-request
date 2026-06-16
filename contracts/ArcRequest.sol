// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
// arc-request: create a payment request (amount + memo), share a link, get paid in USDC.
contract ArcRequest {
    struct Req { address requester; uint256 amount; string memo; bool paid; address payer; uint256 createdAt; uint256 paidAt; }
    Req[] public requests;
    mapping(address => uint256[]) private mine;
    uint256 public totalPaid;
    event Created(uint256 indexed id, address indexed requester, uint256 amount);
    event Paid(uint256 indexed id, address indexed payer, uint256 amount);

    function createRequest(uint256 amount, string calldata memo) external returns (uint256 id) {
        require(amount > 0, "Zero amount");
        id = requests.length;
        requests.push(Req(msg.sender, amount, memo, false, address(0), block.timestamp, 0));
        mine[msg.sender].push(id);
        emit Created(id, msg.sender, amount);
    }
    function pay(uint256 id) external payable {
        Req storage r = requests[id];
        require(!r.paid, "Already paid");
        require(msg.value == r.amount, "Wrong amount");
        r.paid = true; r.payer = msg.sender; r.paidAt = block.timestamp;
        (bool ok,) = payable(r.requester).call{value: msg.value}(""); require(ok, "transfer failed");
        totalPaid += msg.value;
        emit Paid(id, msg.sender, msg.value);
    }
    function getRequest(uint256 id) external view returns (Req memory) { return requests[id]; }
    function getMine(address u) external view returns (uint256[] memory) { return mine[u]; }
    function total() external view returns (uint256) { return requests.length; }
}
