const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.text({ type: "text/xml" }));
app.use(bodyParser.text({ type: "application/xml" }));

// SOAP/XML data store
let soapData = {
  customers: [
    {
      id: 1,
      firstName: "Michael",
      lastName: "Johnson",
      email: "michael@example.com",
      phone: "+1-555-0101",
      address: {
        street: "123 Oak Street",
        city: "Springfield",
        state: "IL",
        zipCode: "62701",
        country: "USA",
      },
    },
    {
      id: 2,
      firstName: "Sarah",
      lastName: "Davis",
      email: "sarah@example.com",
      phone: "+1-555-0102",
      address: {
        street: "456 Maple Avenue",
        city: "Madison",
        state: "WI",
        zipCode: "53703",
        country: "USA",
      },
    },
  ],
  orders: [
    {
      id: 1001,
      customerId: 1,
      orderDate: "2023-12-01T10:30:00Z",
      items: [
        { productId: "PROD-001", name: "Widget A", quantity: 2, price: 25.99 },
        { productId: "PROD-002", name: "Widget B", quantity: 1, price: 45.5 },
      ],
      total: 97.48,
      status: "completed",
    },
    {
      id: 1002,
      customerId: 2,
      orderDate: "2023-12-02T14:15:00Z",
      items: [
        { productId: "PROD-003", name: "Widget C", quantity: 3, price: 15.75 },
      ],
      total: 47.25,
      status: "pending",
    },
  ],
  products: [
    {
      id: "PROD-001",
      name: "Widget A",
      price: 25.99,
      category: "Electronics",
      inStock: true,
    },
    {
      id: "PROD-002",
      name: "Widget B",
      price: 45.5,
      category: "Electronics",
      inStock: true,
    },
    {
      id: "PROD-003",
      name: "Widget C",
      price: 15.75,
      category: "Home",
      inStock: false,
    },
  ],
};

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "TestAPI4",
    timestamp: new Date().toISOString(),
  });
});

// SOAP endpoint
app.post("/soap", (req, res) => {
  const soapRequest = req.body;

  try {
    // Parse SOAP action from headers or body
    const soapAction = req.headers.soapaction || extractSoapAction(soapRequest);

    let responseXml;

    switch (soapAction) {
      case "GetCustomers":
      case "http://tempuri.org/GetCustomers":
        responseXml = generateGetCustomersResponse();
        break;
      case "GetCustomer":
      case "http://tempuri.org/GetCustomer":
        const customerId = extractCustomerId(soapRequest);
        responseXml = generateGetCustomerResponse(customerId);
        break;
      case "CreateCustomer":
      case "http://tempuri.org/CreateCustomer":
        const customerData = extractCustomerData(soapRequest);
        responseXml = generateCreateCustomerResponse(customerData);
        break;
      case "UpdateCustomer":
      case "http://tempuri.org/UpdateCustomer":
        const updateData = extractUpdateCustomerData(soapRequest);
        responseXml = generateUpdateCustomerResponse(updateData);
        break;
      case "GetOrders":
      case "http://tempuri.org/GetOrders":
        const orderCustomerId = extractCustomerId(soapRequest);
        responseXml = generateGetOrdersResponse(orderCustomerId);
        break;
      case "CreateOrder":
      case "http://tempuri.org/CreateOrder":
        const orderData = extractOrderData(soapRequest);
        responseXml = generateCreateOrderResponse(orderData);
        break;
      case "GetProducts":
      case "http://tempuri.org/GetProducts":
        responseXml = generateGetProductsResponse();
        break;
      default:
        responseXml = generateSoapFault(
          "Unknown SOAP action",
          `Action '${soapAction}' is not supported`
        );
        res.status(400);
    }

    res.set("Content-Type", "text/xml; charset=utf-8");
    res.send(responseXml);
  } catch (error) {
    const faultXml = generateSoapFault("Server Error", error.message);
    res
      .status(500)
      .set("Content-Type", "text/xml; charset=utf-8")
      .send(faultXml);
  }
});

// WSDL endpoint
app.get("/soap?wsdl", (req, res) => {
  const wsdl = generateWSDL();
  res.set("Content-Type", "text/xml; charset=utf-8");
  res.send(wsdl);
});

// XML-only endpoints
app.get("/xml/customers", (req, res) => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<customers>
    ${soapData.customers
      .map(
        (customer) => `
    <customer id="${customer.id}">
        <firstName>${customer.firstName}</firstName>
        <lastName>${customer.lastName}</lastName>
        <email>${customer.email}</email>
        <phone>${customer.phone}</phone>
        <address>
            <street>${customer.address.street}</street>
            <city>${customer.address.city}</city>
            <state>${customer.address.state}</state>
            <zipCode>${customer.address.zipCode}</zipCode>
            <country>${customer.address.country}</country>
        </address>
    </customer>`
      )
      .join("")}
</customers>`;

  res.set("Content-Type", "application/xml; charset=utf-8");
  res.send(xml);
});

app.get("/xml/customers/:id", (req, res) => {
  const customerId = parseInt(req.params.id);
  const customer = soapData.customers.find((c) => c.id === customerId);

  if (!customer) {
    const errorXml = `<?xml version="1.0" encoding="UTF-8"?>
<error>
    <code>404</code>
    <message>Customer not found</message>
    <customerId>${customerId}</customerId>
</error>`;
    return res
      .status(404)
      .set("Content-Type", "application/xml; charset=utf-8")
      .send(errorXml);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<customer id="${customer.id}">
    <firstName>${customer.firstName}</firstName>
    <lastName>${customer.lastName}</lastName>
    <email>${customer.email}</email>
    <phone>${customer.phone}</phone>
    <address>
        <street>${customer.address.street}</street>
        <city>${customer.address.city}</city>
        <state>${customer.address.state}</state>
        <zipCode>${customer.address.zipCode}</zipCode>
        <country>${customer.address.country}</country>
    </address>
</customer>`;

  res.set("Content-Type", "application/xml; charset=utf-8");
  res.send(xml);
});

app.post("/xml/customers", (req, res) => {
  try {
    const xmlData = req.body;
    const customerData = parseCustomerXML(xmlData);

    const newCustomer = {
      id: Math.max(...soapData.customers.map((c) => c.id)) + 1,
      ...customerData,
    };

    soapData.customers.push(newCustomer);

    const responseXml = `<?xml version="1.0" encoding="UTF-8"?>
<customerCreated>
    <success>true</success>
    <customerId>${newCustomer.id}</customerId>
    <message>Customer created successfully</message>
</customerCreated>`;

    res
      .status(201)
      .set("Content-Type", "application/xml; charset=utf-8")
      .send(responseXml);
  } catch (error) {
    const errorXml = `<?xml version="1.0" encoding="UTF-8"?>
<error>
    <code>400</code>
    <message>Invalid XML data</message>
    <details>${error.message}</details>
</error>`;
    res
      .status(400)
      .set("Content-Type", "application/xml; charset=utf-8")
      .send(errorXml);
  }
});

app.put("/xml/customers/:id", (req, res) => {
  try {
    const customerId = parseInt(req.params.id);
    const customerIndex = soapData.customers.findIndex(
      (c) => c.id === customerId
    );

    if (customerIndex === -1) {
      const errorXml = `<?xml version="1.0" encoding="UTF-8"?>
<error>
    <code>404</code>
    <message>Customer not found</message>
    <customerId>${customerId}</customerId>
</error>`;
      return res
        .status(404)
        .set("Content-Type", "application/xml; charset=utf-8")
        .send(errorXml);
    }

    const xmlData = req.body;
    const customerData = parseCustomerXML(xmlData);

    soapData.customers[customerIndex] = { id: customerId, ...customerData };

    const responseXml = `<?xml version="1.0" encoding="UTF-8"?>
<customerUpdated>
    <success>true</success>
    <customerId>${customerId}</customerId>
    <message>Customer updated successfully</message>
</customerUpdated>`;

    res.set("Content-Type", "application/xml; charset=utf-8").send(responseXml);
  } catch (error) {
    const errorXml = `<?xml version="1.0" encoding="UTF-8"?>
<error>
    <code>400</code>
    <message>Invalid XML data</message>
    <details>${error.message}</details>
</error>`;
    res
      .status(400)
      .set("Content-Type", "application/xml; charset=utf-8")
      .send(errorXml);
  }
});

// Helper functions for SOAP processing
function extractSoapAction(soapBody) {
  // Simple extraction - in real implementation would use proper XML parsing
  const actionMatch = soapBody.match(/<([^:>\s]+):(\w+)/);
  return actionMatch ? actionMatch[2] : "Unknown";
}

function extractCustomerId(soapBody) {
  const idMatch = soapBody.match(/<customerId>(\d+)<\/customerId>/);
  return idMatch ? parseInt(idMatch[1]) : null;
}

function extractCustomerData(soapBody) {
  const firstNameMatch = soapBody.match(/<firstName>([^<]+)<\/firstName>/);
  const lastNameMatch = soapBody.match(/<lastName>([^<]+)<\/lastName>/);
  const emailMatch = soapBody.match(/<email>([^<]+)<\/email>/);
  const phoneMatch = soapBody.match(/<phone>([^<]+)<\/phone>/);

  return {
    firstName: firstNameMatch ? firstNameMatch[1] : "",
    lastName: lastNameMatch ? lastNameMatch[1] : "",
    email: emailMatch ? emailMatch[1] : "",
    phone: phoneMatch ? phoneMatch[1] : "",
    address: {
      street: "",
      city: "",
      state: "",
      zipCode: "",
      country: "USA",
    },
  };
}

function extractUpdateCustomerData(soapBody) {
  const idMatch = soapBody.match(/<customerId>(\d+)<\/customerId>/);
  return {
    id: idMatch ? parseInt(idMatch[1]) : null,
    ...extractCustomerData(soapBody),
  };
}

function extractOrderData(soapBody) {
  const customerIdMatch = soapBody.match(/<customerId>(\d+)<\/customerId>/);
  const totalMatch = soapBody.match(/<total>([^<]+)<\/total>/);

  return {
    customerId: customerIdMatch ? parseInt(customerIdMatch[1]) : null,
    total: totalMatch ? parseFloat(totalMatch[1]) : 0,
    orderDate: new Date().toISOString(),
    items: [],
    status: "pending",
  };
}

function parseCustomerXML(xmlData) {
  // Simple XML parsing - in production would use proper XML parser
  const firstNameMatch = xmlData.match(/<firstName>([^<]+)<\/firstName>/);
  const lastNameMatch = xmlData.match(/<lastName>([^<]+)<\/lastName>/);
  const emailMatch = xmlData.match(/<email>([^<]+)<\/email>/);
  const phoneMatch = xmlData.match(/<phone>([^<]+)<\/phone>/);

  return {
    firstName: firstNameMatch ? firstNameMatch[1] : "",
    lastName: lastNameMatch ? lastNameMatch[1] : "",
    email: emailMatch ? emailMatch[1] : "",
    phone: phoneMatch ? phoneMatch[1] : "",
    address: {
      street: "",
      city: "",
      state: "",
      zipCode: "",
      country: "USA",
    },
  };
}

// SOAP response generators
function generateGetCustomersResponse() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://tempuri.org/">
    <soap:Body>
        <tns:GetCustomersResponse>
            <tns:customers>
                ${soapData.customers
                  .map(
                    (customer) => `
                <tns:customer>
                    <tns:id>${customer.id}</tns:id>
                    <tns:firstName>${customer.firstName}</tns:firstName>
                    <tns:lastName>${customer.lastName}</tns:lastName>
                    <tns:email>${customer.email}</tns:email>
                    <tns:phone>${customer.phone}</tns:phone>
                </tns:customer>`
                  )
                  .join("")}
            </tns:customers>
        </tns:GetCustomersResponse>
    </soap:Body>
</soap:Envelope>`;
}

function generateGetCustomerResponse(customerId) {
  const customer = soapData.customers.find((c) => c.id === customerId);

  if (!customer) {
    return generateSoapFault(
      "Customer Not Found",
      `Customer with ID ${customerId} not found`
    );
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://tempuri.org/">
    <soap:Body>
        <tns:GetCustomerResponse>
            <tns:customer>
                <tns:id>${customer.id}</tns:id>
                <tns:firstName>${customer.firstName}</tns:firstName>
                <tns:lastName>${customer.lastName}</tns:lastName>
                <tns:email>${customer.email}</tns:email>
                <tns:phone>${customer.phone}</tns:phone>
                <tns:address>
                    <tns:street>${customer.address.street}</tns:street>
                    <tns:city>${customer.address.city}</tns:city>
                    <tns:state>${customer.address.state}</tns:state>
                    <tns:zipCode>${customer.address.zipCode}</tns:zipCode>
                    <tns:country>${customer.address.country}</tns:country>
                </tns:address>
            </tns:customer>
        </tns:GetCustomerResponse>
    </soap:Body>
</soap:Envelope>`;
}

function generateCreateCustomerResponse(customerData) {
  const newCustomer = {
    id: Math.max(...soapData.customers.map((c) => c.id)) + 1,
    ...customerData,
  };

  soapData.customers.push(newCustomer);

  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://tempuri.org/">
    <soap:Body>
        <tns:CreateCustomerResponse>
            <tns:success>true</tns:success>
            <tns:customerId>${newCustomer.id}</tns:customerId>
            <tns:message>Customer created successfully</tns:message>
        </tns:CreateCustomerResponse>
    </soap:Body>
</soap:Envelope>`;
}

function generateUpdateCustomerResponse(updateData) {
  const customerIndex = soapData.customers.findIndex(
    (c) => c.id === updateData.id
  );

  if (customerIndex === -1) {
    return generateSoapFault(
      "Customer Not Found",
      `Customer with ID ${updateData.id} not found`
    );
  }

  soapData.customers[customerIndex] = updateData;

  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://tempuri.org/">
    <soap:Body>
        <tns:UpdateCustomerResponse>
            <tns:success>true</tns:success>
            <tns:customerId>${updateData.id}</tns:customerId>
            <tns:message>Customer updated successfully</tns:message>
        </tns:UpdateCustomerResponse>
    </soap:Body>
</soap:Envelope>`;
}

function generateGetOrdersResponse(customerId) {
  let orders = soapData.orders;

  if (customerId) {
    orders = orders.filter((order) => order.customerId === customerId);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://tempuri.org/">
    <soap:Body>
        <tns:GetOrdersResponse>
            <tns:orders>
                ${orders
                  .map(
                    (order) => `
                <tns:order>
                    <tns:id>${order.id}</tns:id>
                    <tns:customerId>${order.customerId}</tns:customerId>
                    <tns:orderDate>${order.orderDate}</tns:orderDate>
                    <tns:total>${order.total}</tns:total>
                    <tns:status>${order.status}</tns:status>
                </tns:order>`
                  )
                  .join("")}
            </tns:orders>
        </tns:GetOrdersResponse>
    </soap:Body>
</soap:Envelope>`;
}

function generateCreateOrderResponse(orderData) {
  const newOrder = {
    id: Math.max(...soapData.orders.map((o) => o.id)) + 1,
    ...orderData,
  };

  soapData.orders.push(newOrder);

  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://tempuri.org/">
    <soap:Body>
        <tns:CreateOrderResponse>
            <tns:success>true</tns:success>
            <tns:orderId>${newOrder.id}</tns:orderId>
            <tns:message>Order created successfully</tns:message>
        </tns:CreateOrderResponse>
    </soap:Body>
</soap:Envelope>`;
}

function generateGetProductsResponse() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://tempuri.org/">
    <soap:Body>
        <tns:GetProductsResponse>
            <tns:products>
                ${soapData.products
                  .map(
                    (product) => `
                <tns:product>
                    <tns:id>${product.id}</tns:id>
                    <tns:name>${product.name}</tns:name>
                    <tns:price>${product.price}</tns:price>
                    <tns:category>${product.category}</tns:category>
                    <tns:inStock>${product.inStock}</tns:inStock>
                </tns:product>`
                  )
                  .join("")}
            </tns:products>
        </tns:GetProductsResponse>
    </soap:Body>
</soap:Envelope>`;
}

function generateSoapFault(faultCode, faultString) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
    <soap:Body>
        <soap:Fault>
            <faultcode>${faultCode}</faultcode>
            <faultstring>${faultString}</faultstring>
        </soap:Fault>
    </soap:Body>
</soap:Envelope>`;
}

function generateWSDL() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://schemas.xmlsoap.org/wsdl/" 
             xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/" 
             xmlns:tns="http://tempuri.org/" 
             targetNamespace="http://tempuri.org/">
    
    <types>
        <schema xmlns="http://www.w3.org/2001/XMLSchema" targetNamespace="http://tempuri.org/">
            <element name="GetCustomers"/>
            <element name="GetCustomersResponse"/>
            <element name="GetCustomer"/>
            <element name="GetCustomerResponse"/>
            <element name="CreateCustomer"/>
            <element name="CreateCustomerResponse"/>
        </schema>
    </types>
    
    <message name="GetCustomersRequest">
        <part name="parameters" element="tns:GetCustomers"/>
    </message>
    <message name="GetCustomersResponse">
        <part name="parameters" element="tns:GetCustomersResponse"/>
    </message>
    
    <portType name="CustomerServicePortType">
        <operation name="GetCustomers">
            <input message="tns:GetCustomersRequest"/>
            <output message="tns:GetCustomersResponse"/>
        </operation>
    </portType>
    
    <binding name="CustomerServiceBinding" type="tns:CustomerServicePortType">
        <soap:binding style="document" transport="http://schemas.xmlsoap.org/soap/http"/>
        <operation name="GetCustomers">
            <soap:operation soapAction="http://tempuri.org/GetCustomers"/>
            <input><soap:body use="literal"/></input>
            <output><soap:body use="literal"/></output>
        </operation>
    </binding>
    
    <service name="CustomerService">
        <port name="CustomerServicePort" binding="tns:CustomerServiceBinding">
            <soap:address location="http://localhost:${port}/soap"/>
        </port>
    </service>
    
</definitions>`;
}

// Start server
app.listen(port, () => {
  console.log(`Test API 4 (SOAP/XML) running on port ${port}`);
});

module.exports = app;
