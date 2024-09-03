import { createApp } from "@deroll/app";
import { getAddress, hexToString, stringToHex } from "viem";

const app = createApp({ url: process.env.ROLLUP_HTTP_SERVER_URL || "http://127.0.0.1:5004" });

let nfts = {}; // Stores NFT details
let sales = {}; // Stores NFTs listed for sale

app.addAdvanceHandler(async ({ metadata, payload }) => {
    const sender = getAddress(metadata.msg_sender);
    const payloadString = hexToString(payload);
    console.log("Sender:", sender, "Payload:", payloadString);

    try {
        const jsonPayload = JSON.parse(payloadString);

        if (jsonPayload.method === "mint_nft") {
            // Mint a new NFT
            nfts[jsonPayload.tokenId] = {
                creator: sender,
                owner: sender,
                metadata: jsonPayload.metadata
            };
            console.log("NFT minted:", jsonPayload.tokenId);

        } else if (jsonPayload.method === "list_for_sale") {
            // List an NFT for sale
            if (nfts[jsonPayload.tokenId] && nfts[jsonPayload.tokenId].owner === sender) {
                sales[jsonPayload.tokenId] = {
                    price: BigInt(jsonPayload.price),
                    seller: sender
                };
                console.log("NFT listed for sale:", jsonPayload.tokenId);
            } else {
                console.error("Error: NFT not owned by sender or does not exist.");
            }

        } else if (jsonPayload.method === "buy_nft") {
            // Purchase an NFT
            const sale = sales[jsonPayload.tokenId];
            if (sale && BigInt(jsonPayload.amount) >= sale.price) {
                const nft = nfts[jsonPayload.tokenId];
                const royalty = sale.price * BigInt(0.05); // 5% royalty
                const amountToSeller = sale.price - royalty;
                
                // Transfer the NFT ownership
                nft.owner = sender;
                nfts[jsonPayload.tokenId] = nft;
                delete sales[jsonPayload.tokenId];

                console.log("NFT purchased:", jsonPayload.tokenId);

                // Handle royalties (you can implement the transfer of royalty to creator here)
                console.log("Royalty amount:", royalty.toString(), "to be transferred to creator:", nft.creator);
                console.log("Amount to seller:", amountToSeller.toString());

            } else {
                console.error("Error: Sale not found or insufficient amount.");
            }
        }
        return "accept";
    } catch (e) {
        console.error(e);
        app.createReport({ payload: stringToHex(String(e)) });
        return "reject";
    }
});

app.addInspectHandler(async ({ payload }) => {
    const tokenId = hexToString(payload).split("/")[1];
    const nft = nfts[tokenId] || {};
    const sale = sales[tokenId] || {};
    
    const response = {
        nft: nft,
        sale: sale
    };

    await app.createReport({ payload: stringToHex(JSON.stringify(response)) });
});

app.start().catch((e) => {
    console.error(e);
    process.exit(1);
});
