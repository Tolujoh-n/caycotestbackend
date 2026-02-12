const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/User');
const Company = require('../models/Company');
const Customer = require('../models/Customer');
const Job = require('../models/Job');
const Estimate = require('../models/Estimate');
const Invoice = require('../models/Invoice');
const Schedule = require('../models/Schedule');
const PurchaseOrder = require('../models/PurchaseOrder');
const Inventory = require('../models/Inventory');
const Equipment = require('../models/Equipment');
const Role = require('../models/Role');
const Project = require('../models/Project');
const Team = require('../models/Team');
const Task = require('../models/Task');
const Message = require('../models/Message');
const File = require('../models/File');
const TabConfig = require('../models/TabConfig');
const Event = require('../models/Event');
const Appointment = require('../models/Appointment');
const BoardSection = require('../models/BoardSection');

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/cayco', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB Connected');
  } catch (err) {
    console.error('MongoDB Connection Error:', err);
    process.exit(1);
  }
};

const seedData = async () => {
  await connectDB();
  try {
    // Clear existing data (optional - comment out if you want to keep existing data)
    console.log('Clearing existing data...');
    await User.deleteMany({});
    await Company.deleteMany();
    await Customer.deleteMany();
    await Job.deleteMany();
    await Estimate.deleteMany();
    await Invoice.deleteMany();
    await Schedule.deleteMany();
    await PurchaseOrder.deleteMany();
    await Inventory.deleteMany();
    await Equipment.deleteMany();
    await Role.deleteMany();
    await Project.deleteMany();
    await Team.deleteMany();
    await Task.deleteMany();
    await Message.deleteMany();
    await File.deleteMany();
    await TabConfig.deleteMany();
    await Event.deleteMany();
    await Appointment.deleteMany();
    await BoardSection.deleteMany();

    // Create Super Admin
    let superAdmin = await User.findOne({ email: 'admin@cayco.com' });
    if (!superAdmin) {
      superAdmin = await User.create({
        email: 'admin@cayco.com',
        password: 'admin123',
        firstName: 'Super',
        lastName: 'Admin',
        role: 'Super Admin',
        isActive: true
      });
      console.log('Super Admin created:', superAdmin.email);
    } else {
      console.log('Super Admin already exists:', superAdmin.email);
    }

    // Create Company Owner first (with temporary companyId)
    const tempCompanyId = new mongoose.Types.ObjectId();
    
    const owner = await User.create({
      email: 'owner@demo.com',
      password: 'password123',
      firstName: 'John',
      lastName: 'Doe',
      role: 'Company Owner',
      companyId: tempCompanyId, // Temporary, will be updated
      phone: '555-0101',
      isActive: true,
      onboardingCompleted: true
    });

    // Create Company with owner
    const company = await Company.create({
      name: 'Demo Construction Company',
      email: 'demo@construction.com',
      phone: '555-0100',
      owner: owner._id,
      industry: 'Construction',
      address: {
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        country: 'USA'
      },
      pricingRules: {
        defaultMarkup: 0.25,
        laborRate: 50
      }
    });

    // Update owner with correct companyId
    owner.companyId = company._id;
    await owner.save();

    console.log('Company created:', company.name);

    // Create Team Members
    const operationsManager = await User.create({
      email: 'ops@demo.com',
      password: 'password123',
      firstName: 'Jane',
      lastName: 'Smith',
      role: 'Operations Manager',
      companyId: company._id,
      phone: '555-0102',
      isActive: true
    });

    const estimator = await User.create({
      email: 'estimator@demo.com',
      password: 'password123',
      firstName: 'Mike',
      lastName: 'Johnson',
      role: 'Estimator',
      companyId: company._id,
      phone: '555-0103',
      isActive: true
    });

    const accountant = await User.create({
      email: 'accountant@demo.com',
      password: 'password123',
      firstName: 'Sarah',
      lastName: 'Williams',
      role: 'Accountant',
      companyId: company._id,
      phone: '555-0104',
      isActive: true
    });

    const staff1 = await User.create({
      email: 'staff1@demo.com',
      password: 'password123',
      firstName: 'Tom',
      lastName: 'Brown',
      role: 'Staff',
      companyId: company._id,
      phone: '555-0105',
      isActive: true
    });

    const staff2 = await User.create({
      email: 'staff2@demo.com',
      password: 'password123',
      firstName: 'Chris',
      lastName: 'Davis',
      role: 'Staff',
      companyId: company._id,
      phone: '555-0106',
      isActive: true
    });

    console.log('Team members created');

    // Create Customers
    const customers = [];
    const customerNames = [
      { firstName: 'Alice', lastName: 'Anderson', email: 'alice@example.com', company: 'Anderson Corp' },
      { firstName: 'Bob', lastName: 'Brown', email: 'bob@example.com', company: 'Brown Enterprises' },
      { firstName: 'Carol', lastName: 'Clark', email: 'carol@example.com', company: 'Clark Industries' },
      { firstName: 'David', lastName: 'Davis', email: 'david@example.com', company: '' },
      { firstName: 'Emma', lastName: 'Evans', email: 'emma@example.com', company: 'Evans Group' }
    ];

    for (const name of customerNames) {
      const customer = await Customer.create({
        companyId: company._id,
        firstName: name.firstName,
        lastName: name.lastName,
        email: name.email,
        phone: `555-${Math.floor(Math.random() * 9000) + 1000}`,
        company: name.company || undefined,
        type: Math.random() > 0.5 ? 'Commercial' : 'Residential',
        status: Math.random() > 0.3 ? 'Active' : 'Lead',
        address: {
          street: `${Math.floor(Math.random() * 9999) + 1} Street`,
          city: 'New York',
          state: 'NY',
          zipCode: `${Math.floor(Math.random() * 90000) + 10000}`,
          country: 'USA'
        }
      });
      customers.push(customer);
    }

    console.log('Customers created');

    // Create Estimates
    const estimates = [];
    for (let i = 0; i < 8; i++) {
      const customer = customers[Math.floor(Math.random() * customers.length)];
      const lineItems = [
        {
          description: 'Labor - Installation',
          quantity: Math.floor(Math.random() * 5) + 1,
          unit: 'hours',
          unitPrice: 50,
          markup: 25,
          category: 'Labor'
        },
        {
          description: 'Materials - Premium Grade',
          quantity: Math.floor(Math.random() * 10) + 5,
          unit: 'sqft',
          unitPrice: 15,
          markup: 30,
          category: 'Materials'
        }
      ];

      const subtotal = lineItems.reduce((sum, item) => {
        const itemTotal = item.quantity * item.unitPrice;
        return sum + (itemTotal * (1 + item.markup / 100));
      }, 0);

      const taxAmount = subtotal * 0.08;
      const total = subtotal + taxAmount;

      const estimate = await Estimate.create({
        companyId: company._id,
        estimateNumber: `EST-${String(i + 1).padStart(6, '0')}`,
        customerId: customer._id,
        title: `Project Estimate #${i + 1}`,
        description: `Detailed estimate for ${customer.firstName} ${customer.lastName}`,
        status: ['Draft', 'Sent', 'Accepted', 'Rejected'][Math.floor(Math.random() * 4)],
        lineItems,
        subtotal,
        taxRate: 8,
        taxAmount,
        total,
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        createdBy: estimator._id
      });
      estimates.push(estimate);
    }

    console.log('Estimates created');

    // Create Jobs
    const jobs = [];
    for (let i = 0; i < 12; i++) {
      const customer = customers[Math.floor(Math.random() * customers.length)];
      const estimate = i < estimates.length ? estimates[i] : null;
      const statuses = ['Quote', 'Scheduled', 'In Progress', 'Completed', 'Cancelled'];
      const status = statuses[Math.floor(Math.random() * statuses.length)];

      const laborEstimated = Math.floor(Math.random() * 5000) + 1000;
      const materialsEstimated = Math.floor(Math.random() * 8000) + 2000;
      const equipmentEstimated = Math.floor(Math.random() * 2000) + 500;
      const totalEstimated = laborEstimated + materialsEstimated + equipmentEstimated;

      const laborActual = status === 'Completed' ? laborEstimated + Math.floor(Math.random() * 500 - 250) : 0;
      const materialsActual = status === 'Completed' ? materialsEstimated + Math.floor(Math.random() * 800 - 400) : 0;
      const totalActual = laborActual + materialsActual;

      const revenue = estimate ? estimate.total : totalEstimated * 1.3;
      const profit = status === 'Completed' ? revenue - totalActual : 0;
      const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;

      const job = await Job.create({
        companyId: company._id,
        jobNumber: `JOB-${String(i + 1).padStart(6, '0')}`,
        customerId: customer._id,
        title: `Job #${i + 1} - ${customer.firstName} ${customer.lastName}`,
        description: `Project work for ${customer.firstName} ${customer.lastName}`,
        status,
        priority: ['Low', 'Medium', 'High'][Math.floor(Math.random() * 3)],
        location: customer.address,
        startDate: status !== 'Quote' ? new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000) : undefined,
        endDate: status === 'Completed' ? new Date(Date.now() - Math.floor(Math.random() * 10) * 24 * 60 * 60 * 1000) : undefined,
        assignedTo: [staff1._id, staff2._id].slice(0, Math.floor(Math.random() * 2) + 1),
        estimateId: estimate?._id,
        costs: {
          labor: { estimated: laborEstimated, actual: laborActual },
          materials: { estimated: materialsEstimated, actual: materialsActual },
          equipment: { estimated: equipmentEstimated, actual: 0 },
          subcontractors: { estimated: 0, actual: 0 },
          overhead: { estimated: totalEstimated * 0.1, actual: totalActual * 0.1 },
          total: { estimated: totalEstimated, actual: totalActual }
        },
        revenue,
        profit,
        profitMargin
      });
      jobs.push(job);
    }

    console.log('Jobs created');

    // Create Invoices
    const invoices = [];
    for (let i = 0; i < 10; i++) {
      const job = jobs[Math.floor(Math.random() * jobs.length)];
      const customer = job.customerId;
      const statuses = ['Draft', 'Sent', 'Paid', 'Partial', 'Overdue'];
      const status = statuses[Math.floor(Math.random() * statuses.length)];

      const lineItems = [
        {
          description: `Invoice for ${job.title}`,
          quantity: 1,
          unit: 'job',
          unitPrice: job.revenue,
          total: job.revenue
        }
      ];

      const subtotal = job.revenue;
      const taxAmount = subtotal * 0.08;
      const total = subtotal + taxAmount;

      let paidAmount = 0;
      if (status === 'Paid') paidAmount = total;
      else if (status === 'Partial') paidAmount = total * 0.5;

      const invoice = await Invoice.create({
        companyId: company._id,
        invoiceNumber: `INV-${String(i + 1).padStart(6, '0')}`,
        customerId: customer,
        jobId: job._id,
        status,
        issueDate: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000),
        dueDate: new Date(Date.now() + (30 - Math.floor(Math.random() * 30)) * 24 * 60 * 60 * 1000),
        lineItems,
        subtotal,
        taxRate: 8,
        taxAmount,
        total,
        paidAmount,
        balance: total - paidAmount,
        paymentTerms: 'Net 30',
        createdBy: accountant._id
      });

      // Update job with invoice reference
      job.invoiceId = invoice._id;
      await job.save();

      invoices.push(invoice);
    }

    console.log('Invoices created');

    // Create Schedules
    for (let i = 0; i < 15; i++) {
      const job = jobs[Math.floor(Math.random() * jobs.length)];
      const customer = job.customerId;
      const startTime = new Date(Date.now() + Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000);
      const endTime = new Date(startTime.getTime() + 4 * 60 * 60 * 1000); // 4 hours later

      await Schedule.create({
        companyId: company._id,
        jobId: job._id,
        customerId: customer,
        title: `Schedule for ${job.title}`,
        description: 'Scheduled work',
        startTime,
        endTime,
        assignedTo: job.assignedTo,
        location: job.location,
        status: ['Scheduled', 'In Progress'][Math.floor(Math.random() * 2)]
      });
    }

    console.log('Schedules created');

    // Update customer stats
    for (const customer of customers) {
      const customerJobs = jobs.filter(j => j.customerId.toString() === customer._id.toString());
      const customerInvoices = invoices.filter(inv => inv.customerId.toString() === customer._id.toString());
      
      customer.totalJobs = customerJobs.length;
      customer.totalRevenue = customerInvoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);
      await customer.save();
    }

    console.log('Customer stats updated');

    // Create Purchase Orders
    const vendors = [
      { name: 'ABC Supplies', email: 'orders@abcsupplies.com', phone: '555-2001' },
      { name: 'XYZ Materials', email: 'sales@xyzmaterials.com', phone: '555-2002' },
      { name: 'Builders Depot', email: 'info@buildersdepot.com', phone: '555-2003' }
    ];

    for (let i = 0; i < 8; i++) {
      const vendor = vendors[Math.floor(Math.random() * vendors.length)];
      const job = jobs[Math.floor(Math.random() * jobs.length)];
      const items = [
        {
          description: 'Concrete Mix - Premium Grade',
          quantity: Math.floor(Math.random() * 20) + 5,
          unit: 'bags',
          unitPrice: 8.50,
          total: 0,
          category: 'Materials'
        },
        {
          description: 'Steel Rebar - 1/2 inch',
          quantity: Math.floor(Math.random() * 50) + 10,
          unit: 'pieces',
          unitPrice: 12.00,
          total: 0,
          category: 'Materials'
        }
      ];

      items.forEach(item => {
        item.total = item.quantity * item.unitPrice;
      });

      const subtotal = items.reduce((sum, item) => sum + item.total, 0);
      const tax = subtotal * 0.08;
      const shipping = subtotal * 0.05;
      const total = subtotal + tax + shipping;

      const statuses = ['Draft', 'Sent', 'Received', 'Completed'];
      const status = statuses[Math.floor(Math.random() * statuses.length)];

      await PurchaseOrder.create({
        companyId: company._id,
        poNumber: `PO-${String(i + 1).padStart(6, '0')}`,
        vendor,
        items,
        jobId: job._id,
        status,
        orderDate: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000),
        expectedDelivery: new Date(Date.now() + Math.floor(Math.random() * 14) * 24 * 60 * 60 * 1000),
        receivedDate: status === 'Received' || status === 'Completed' ? new Date() : undefined,
        subtotal,
        tax,
        shipping,
        total,
        createdBy: operationsManager._id
      });
    }

    console.log('Purchase Orders created');

    // Create Inventory Items
    const inventoryItems = [
      { name: 'Concrete Mix - 50lb', sku: 'CM-50', category: 'Materials', unit: 'bag', unitCost: 8.50, quantity: 45, reorderPoint: 20 },
      { name: 'Steel Rebar 1/2"', sku: 'SR-12', category: 'Materials', unit: 'piece', unitCost: 12.00, quantity: 120, reorderPoint: 50 },
      { name: 'Lumber - 2x4x8', sku: 'LB-2X4', category: 'Materials', unit: 'piece', unitCost: 5.75, quantity: 200, reorderPoint: 100 },
      { name: 'Drywall - 4x8', sku: 'DW-48', category: 'Materials', unit: 'sheet', unitCost: 15.00, quantity: 85, reorderPoint: 40 },
      { name: 'Paint - White', sku: 'PT-WHT', category: 'Supplies', unit: 'gallon', unitCost: 35.00, quantity: 25, reorderPoint: 10 },
      { name: 'Hammer', sku: 'TL-HMR', category: 'Tools', unit: 'ea', unitCost: 25.00, quantity: 15, reorderPoint: 5 },
      { name: 'Drill Bits Set', sku: 'TL-DBS', category: 'Tools', unit: 'set', unitCost: 45.00, quantity: 8, reorderPoint: 3 }
    ];

    for (const item of inventoryItems) {
      await Inventory.create({
        companyId: company._id,
        ...item,
        location: 'Warehouse A',
        supplier: vendors[0],
        lastRestocked: new Date(Date.now() - Math.floor(Math.random() * 7) * 24 * 60 * 60 * 1000)
      });
    }

    console.log('Inventory items created');

    // Create Equipment
    const equipmentItems = [
      { name: 'Excavator CAT 320', type: 'Machinery', make: 'Caterpillar', model: '320', year: 2020, status: 'Active' },
      { name: 'Dump Truck', type: 'Vehicle', make: 'Ford', model: 'F-750', year: 2019, status: 'Active' },
      { name: 'Concrete Mixer', type: 'Machinery', make: 'Cemen Tech', model: 'CM-250', year: 2021, status: 'Active' },
      { name: 'Forklift', type: 'Machinery', make: 'Toyota', model: '8FGCU25', year: 2018, status: 'Maintenance' },
      { name: 'Pickup Truck', type: 'Vehicle', make: 'Chevrolet', model: 'Silverado 2500', year: 2022, status: 'Active' },
      { name: 'Power Drill', type: 'Tool', make: 'DeWalt', model: 'DCD991', year: 2023, status: 'Active' }
    ];

    for (let i = 0; i < equipmentItems.length; i++) {
      const eq = equipmentItems[i];
      const equipment = await Equipment.create({
        companyId: company._id,
        equipmentNumber: `EQ-${String(i + 1).padStart(6, '0')}`,
        ...eq,
        purchaseDate: new Date(2020 + i, 0, 1),
        purchasePrice: [45000, 35000, 28000, 22000, 42000, 250][i],
        currentValue: [38000, 28000, 25000, 18000, 40000, 200][i],
        location: 'Main Yard',
        assignedTo: i < 3 ? [staff1._id, staff2._id][i % 2] : undefined,
        maintenanceSchedule: ['Monthly', 'Quarterly', 'As Needed'][i % 3],
        lastMaintenance: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000),
        nextMaintenance: new Date(Date.now() + Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000),
        hoursUsed: Math.floor(Math.random() * 2000) + 500,
        maintenanceRecords: [
          {
            date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            type: 'Maintenance',
            description: 'Regular service',
            cost: Math.floor(Math.random() * 500) + 100,
            performedBy: 'Service Center',
            nextServiceDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          }
        ],
        totalMaintenanceCost: Math.floor(Math.random() * 2000) + 500
      });
    }

    console.log('Equipment created');

    // Create Custom Roles with Permissions
    const customRoles = [
      {
        name: 'Project Manager',
        description: 'Manages projects and coordinates teams',
        isSystemRole: false,
        permissions: [
          { resource: 'jobs', actions: ['view', 'create', 'edit'] },
          { resource: 'schedules', actions: ['view', 'create', 'edit'] },
          { resource: 'customers', actions: ['view', 'create', 'edit'] },
          { resource: 'reports', actions: ['view'] }
        ]
      },
      {
        name: 'Field Supervisor',
        description: 'Supervises field operations',
        isSystemRole: false,
        permissions: [
          { resource: 'jobs', actions: ['view', 'edit'] },
          { resource: 'schedules', actions: ['view', 'create', 'edit'] },
          { resource: 'equipment', actions: ['view', 'edit'] }
        ]
      }
    ];

    for (const roleData of customRoles) {
      await Role.create({
        companyId: company._id,
        ...roleData,
        createdBy: owner._id
      });
    }

    // Create System Roles
    const systemRoles = [
      {
        name: 'Company Owner',
        description: 'Full access to all company features',
        isSystemRole: true,
        permissions: [
          { resource: 'jobs', actions: ['view', 'create', 'edit', 'delete', 'manage'] },
          { resource: 'schedules', actions: ['view', 'create', 'edit', 'delete', 'manage'] },
          { resource: 'customers', actions: ['view', 'create', 'edit', 'delete', 'manage'] },
          { resource: 'estimates', actions: ['view', 'create', 'edit', 'delete', 'manage'] },
          { resource: 'invoices', actions: ['view', 'create', 'edit', 'delete', 'manage'] },
          { resource: 'reports', actions: ['view', 'manage'] },
          { resource: 'users', actions: ['view', 'create', 'edit', 'delete', 'manage'] },
          { resource: 'purchasing', actions: ['view', 'create', 'edit', 'delete', 'manage'] },
          { resource: 'equipment', actions: ['view', 'create', 'edit', 'delete', 'manage'] }
        ]
      },
      {
        name: 'Operations Manager',
        description: 'Manages daily operations',
        isSystemRole: true,
        permissions: [
          { resource: 'jobs', actions: ['view', 'create', 'edit'] },
          { resource: 'schedules', actions: ['view', 'create', 'edit', 'manage'] },
          { resource: 'customers', actions: ['view', 'create', 'edit'] },
          { resource: 'reports', actions: ['view'] },
          { resource: 'users', actions: ['view'] }
        ]
      },
      {
        name: 'Estimator',
        description: 'Creates and manages estimates',
        isSystemRole: true,
        permissions: [
          { resource: 'estimates', actions: ['view', 'create', 'edit'] },
          { resource: 'customers', actions: ['view', 'create', 'edit'] },
          { resource: 'jobs', actions: ['view'] }
        ]
      },
      {
        name: 'Accountant',
        description: 'Manages financial records',
        isSystemRole: true,
        permissions: [
          { resource: 'invoices', actions: ['view', 'create', 'edit', 'manage'] },
          { resource: 'reports', actions: ['view', 'manage'] },
          { resource: 'customers', actions: ['view'] },
          { resource: 'jobs', actions: ['view'] }
        ]
      },
      {
        name: 'Staff',
        description: 'Field staff member',
        isSystemRole: true,
        permissions: [
          { resource: 'jobs', actions: ['view', 'edit'] },
          { resource: 'schedules', actions: ['view'] },
          { resource: 'equipment', actions: ['view'] }
        ]
      }
    ];

    for (const roleData of systemRoles) {
      await Role.create({
        companyId: company._id,
        ...roleData,
        createdBy: owner._id
      });
    }

    console.log('Roles created');

    // Create Projects
    const projects = [
      {
        name: 'Website Redesign',
        description: 'Complete redesign of company website with modern UI/UX',
        color: '#4F46E5',
        owner: owner._id,
        members: [owner._id, operationsManager._id, estimator._id],
        status: 'Active',
        startDate: new Date('2024-01-15'),
        dueDate: new Date('2024-03-30'),
        tags: ['design', 'development', 'priority']
      },
      {
        name: 'Mobile App Development',
        description: 'Build native mobile app for iOS and Android',
        color: '#10B981',
        owner: operationsManager._id,
        members: [owner._id, operationsManager._id, staff1._id, staff2._id],
        status: 'Active',
        startDate: new Date('2024-02-01'),
        dueDate: new Date('2024-05-15'),
        tags: ['mobile', 'development', 'urgent']
      },
      {
        name: 'Marketing Campaign Q2',
        description: 'Quarterly marketing campaign planning and execution',
        color: '#F59E0B',
        owner: owner._id,
        members: [owner._id, operationsManager._id, accountant._id],
        status: 'Active',
        startDate: new Date('2024-03-01'),
        dueDate: new Date('2024-06-30'),
        tags: ['marketing', 'strategy']
      },
      {
        name: 'Customer Portal',
        description: 'Build customer self-service portal',
        color: '#EF4444',
        owner: operationsManager._id,
        members: [operationsManager._id, estimator._id, staff1._id],
        status: 'On Hold',
        startDate: new Date('2024-01-20'),
        dueDate: new Date('2024-04-20'),
        tags: ['portal', 'customer']
      }
    ];

    const createdProjects = [];
    for (const projectData of projects) {
      const project = await Project.create({
        ...projectData,
        companyId: company._id
      });
      createdProjects.push(project);
    }
    console.log(`${createdProjects.length} Projects created`);

    // Create Teams
    const teams = [
      {
        name: 'Development Team',
        description: 'Software development and engineering team',
        color: '#3B82F6',
        owner: operationsManager._id,
        members: [operationsManager._id, estimator._id, staff1._id, staff2._id]
      },
      {
        name: 'Design Team',
        description: 'UI/UX and graphic design team',
        color: '#8B5CF6',
        owner: owner._id,
        members: [owner._id, operationsManager._id, estimator._id]
      },
      {
        name: 'Marketing Team',
        description: 'Marketing and communications team',
        color: '#EC4899',
        owner: owner._id,
        members: [owner._id, operationsManager._id, accountant._id]
      },
      {
        name: 'Operations Team',
        description: 'Operations and project management team',
        color: '#14B8A6',
        owner: operationsManager._id,
        members: [operationsManager._id, staff1._id, staff2._id]
      }
    ];

    const createdTeams = [];
    for (const teamData of teams) {
      const team = await Team.create({
        ...teamData,
        companyId: company._id
      });
      createdTeams.push(team);
    }
    console.log(`${createdTeams.length} Teams created`);

    // Create Board Sections for first project only (users can create more)
    // Sections are like project categories, not workflow stages
    const boardSections = [];
    if (createdProjects.length > 0) {
      const firstProject = createdProjects[0];
      const sections = [
        { name: 'Social media campaign launch', order: 0, projectId: firstProject._id },
        { name: 'Implement user dashboard', order: 1, projectId: firstProject._id },
        { name: 'Budget approval for Q2 campaign', order: 2, projectId: firstProject._id }
      ];
      for (const sectionData of sections) {
        const section = await BoardSection.create({
          ...sectionData,
          companyId: company._id,
          createdBy: owner._id
        });
        boardSections.push({ ...section.toObject(), projectId: firstProject._id });
      }
    }
    console.log(`${boardSections.length} Board Sections created`);

    // Create Tasks
    const tasks = [
      {
        title: 'Design homepage mockup',
        description: 'Create initial design mockup for homepage with modern layout',
        projectId: createdProjects[0]._id,
        assignedTo: [estimator._id],
        createdBy: owner._id,
        status: 'In Progress',
        priority: 'High',
        dueDate: new Date('2024-02-15'),
        tags: ['design', 'homepage'],
        subtasks: [
          { title: 'Create wireframes', completed: true },
          { title: 'Design color scheme', completed: true },
          { title: 'Create responsive layouts', completed: false }
        ]
      },
      {
        title: 'Set up development environment',
        description: 'Configure development servers and CI/CD pipeline',
        projectId: createdProjects[1]._id,
        assignedTo: [staff1._id, staff2._id],
        createdBy: operationsManager._id,
        status: 'Completed',
        priority: 'Urgent',
        dueDate: new Date('2024-02-10'),
        completedAt: new Date('2024-02-08'),
        completedBy: staff1._id,
        tags: ['devops', 'setup']
      },
      {
        title: 'Create marketing strategy document',
        description: 'Draft comprehensive marketing strategy for Q2 campaign',
        projectId: createdProjects[2]._id,
        assignedTo: [operationsManager._id],
        createdBy: owner._id,
        status: 'In Review',
        priority: 'Medium',
        dueDate: new Date('2024-03-15'),
        tags: ['strategy', 'marketing']
      },
      {
        title: 'User authentication system',
        description: 'Implement secure user authentication and authorization',
        projectId: createdProjects[1]._id,
        assignedTo: [staff1._id],
        createdBy: operationsManager._id,
        status: 'In Progress',
        priority: 'High',
        dueDate: new Date('2024-03-01'),
        tags: ['backend', 'security'],
        subtasks: [
          { title: 'Set up JWT tokens', completed: true },
          { title: 'Implement password hashing', completed: true },
          { title: 'Add OAuth integration', completed: false }
        ]
      },
      {
        title: 'API documentation',
        description: 'Write comprehensive API documentation for developers',
        projectId: createdProjects[1]._id,
        assignedTo: [staff2._id],
        createdBy: operationsManager._id,
        status: 'Not Started',
        priority: 'Low',
        dueDate: new Date('2024-04-01'),
        tags: ['documentation']
      },
      {
        title: 'Review competitor analysis',
        description: 'Analyze competitor websites and identify best practices',
        projectId: createdProjects[0]._id,
        assignedTo: [estimator._id],
        createdBy: owner._id,
        status: 'Completed',
        priority: 'Medium',
        dueDate: new Date('2024-01-30'),
        completedAt: new Date('2024-01-28'),
        completedBy: estimator._id,
        tags: ['research', 'analysis']
      },
      {
        title: 'Budget approval for Q2 campaign',
        description: 'Get budget approval from finance team',
        projectId: createdProjects[2]._id,
        assignedTo: [accountant._id],
        createdBy: owner._id,
        status: 'Blocked',
        priority: 'Urgent',
        dueDate: new Date('2024-03-05'),
        tags: ['finance', 'approval']
      },
      {
        title: 'Implement user dashboard',
        description: 'Build user dashboard with analytics and widgets',
        projectId: createdProjects[0]._id,
        assignedTo: [staff1._id, estimator._id],
        createdBy: owner._id,
        status: 'In Progress',
        priority: 'High',
        dueDate: new Date('2024-02-20'),
        tags: ['frontend', 'dashboard']
      },
      {
        title: 'Database optimization',
        description: 'Optimize database queries and add indexes',
        projectId: createdProjects[1]._id,
        assignedTo: [staff2._id],
        createdBy: operationsManager._id,
        status: 'Not Started',
        priority: 'Medium',
        dueDate: new Date('2024-03-10'),
        tags: ['database', 'performance']
      },
      {
        title: 'Social media campaign launch',
        description: 'Launch social media campaign across all platforms',
        projectId: createdProjects[2]._id,
        assignedTo: [operationsManager._id, accountant._id],
        createdBy: owner._id,
        status: 'In Progress',
        priority: 'High',
        dueDate: new Date('2024-03-20'),
        tags: ['marketing', 'social-media']
      }
    ];

    const createdTasks = [];
    for (let i = 0; i < tasks.length; i++) {
      const taskData = tasks[i];
      // Assign tasks to sections only if task belongs to first project (which has sections)
      if (taskData.projectId && taskData.projectId.toString() === createdProjects[0]._id.toString()) {
        const projectSections = boardSections.filter(s => s.projectId?.toString() === taskData.projectId?.toString());
        if (projectSections.length > 0) {
          const sectionIndex = i % projectSections.length;
          taskData.sectionId = projectSections[sectionIndex]._id;
        }
      }
      
      const task = await Task.create({
        ...taskData,
        companyId: company._id
      });
      createdTasks.push(task);
    }
    console.log(`${createdTasks.length} Tasks created`);

    // Create Messages
    const messages = [
      {
        projectId: createdProjects[0]._id,
        sender: owner._id,
        content: 'Welcome to the Website Redesign project! Let\'s make this amazing. 🚀',
        mentions: [operationsManager._id, estimator._id]
      },
      {
        projectId: createdProjects[0]._id,
        sender: operationsManager._id,
        content: 'Thanks! I\'ve reviewed the requirements. Should we start with the homepage design?',
        mentions: [owner._id]
      },
      {
        projectId: createdProjects[1]._id,
        sender: operationsManager._id,
        content: 'Development environment is ready! @staff1 @staff2 you can start working on the authentication system.',
        mentions: [staff1._id, staff2._id]
      },
      {
        teamId: createdTeams[0]._id,
        sender: operationsManager._id,
        content: 'Team meeting scheduled for Friday at 2 PM. Please confirm attendance.',
        mentions: [estimator._id, staff1._id, staff2._id]
      },
      {
        taskId: createdTasks[0]._id,
        sender: estimator._id,
        content: 'First draft of homepage mockup is ready for review. Feedback welcome!',
        mentions: [owner._id]
      },
      {
        projectId: createdProjects[0]._id,
        sender: estimator._id,
        content: 'I\'ve completed the wireframes. Should I proceed with the color scheme?',
        mentions: [owner._id]
      },
      {
        projectId: createdProjects[1]._id,
        sender: staff1._id,
        content: 'Authentication system is 80% complete. Need to add OAuth integration.',
        mentions: [operationsManager._id]
      },
      {
        teamId: createdTeams[1]._id,
        sender: owner._id,
        content: 'Design review meeting tomorrow at 10 AM. Please prepare your designs.',
        mentions: [operationsManager._id, estimator._id]
      },
      {
        projectId: createdProjects[2]._id,
        sender: accountant._id,
        content: 'Budget has been approved! We can proceed with the campaign.',
        mentions: [owner._id, operationsManager._id]
      },
      {
        taskId: createdTasks[3]._id,
        sender: staff1._id,
        content: 'JWT implementation is done. Testing in progress.',
        mentions: [operationsManager._id]
      }
    ];

    for (const messageData of messages) {
      await Message.create({
        ...messageData,
        companyId: company._id
      });
    }
    console.log(`${messages.length} Messages created`);

    // Create Events (calendar-specific)
    const events = [
      {
        title: 'Team Standup Meeting',
        description: 'Daily standup meeting to discuss progress and blockers',
        startDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000),
        allDay: false,
        location: 'Conference Room A',
        color: '#10B981',
        projectId: createdProjects[0]._id,
        attendees: [owner._id, operationsManager._id, estimator._id],
        createdBy: owner._id
      },
      {
        title: 'Sprint Planning',
        description: 'Plan next sprint tasks and assign work',
        startDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
        allDay: false,
        location: 'Main Office',
        color: '#3B82F6',
        projectId: createdProjects[1]._id,
        attendees: [operationsManager._id, staff1._id, staff2._id],
        createdBy: operationsManager._id
      },
      {
        title: 'Design Review',
        description: 'Review design mockups and provide feedback',
        startDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
        allDay: false,
        location: 'Design Studio',
        color: '#8B5CF6',
        teamId: createdTeams[0]._id,
        attendees: [owner._id, estimator._id],
        createdBy: owner._id
      },
      {
        title: 'Company All-Hands',
        description: 'Monthly all-hands meeting for all employees',
        startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
        allDay: false,
        location: 'Main Auditorium',
        color: '#F59E0B',
        attendees: [owner._id, operationsManager._id, estimator._id, accountant._id, staff1._id, staff2._id],
        createdBy: owner._id
      }
    ];

    for (const eventData of events) {
      await Event.create({
        ...eventData,
        companyId: company._id
      });
    }
    console.log(`${events.length} Events created`);

    // Create Appointments (calendar-specific)
    const appointments = [
      {
        title: 'Client Meeting - ABC Corp',
        description: 'Discuss project requirements and timeline',
        startDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
        location: 'Client Office - 123 Business St',
        color: '#EC4899',
        projectId: createdProjects[0]._id,
        attendees: [owner._id, operationsManager._id],
        createdBy: owner._id,
        status: 'Scheduled'
      },
      {
        title: 'Vendor Presentation',
        description: 'Review new software vendor proposal',
        startDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000 + 90 * 60 * 1000),
        location: 'Conference Room B',
        color: '#14B8A6',
        teamId: createdTeams[2]._id,
        attendees: [operationsManager._id, accountant._id],
        createdBy: operationsManager._id,
        status: 'Confirmed'
      },
      {
        title: 'Budget Review Meeting',
        description: 'Quarterly budget review and planning',
        startDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000 + 90 * 60 * 1000),
        location: 'Finance Office',
        color: '#EF4444',
        attendees: [owner._id, accountant._id],
        createdBy: owner._id,
        status: 'Scheduled'
      }
    ];

    for (const appointmentData of appointments) {
      await Appointment.create({
        ...appointmentData,
        companyId: company._id
      });
    }
    console.log(`${appointments.length} Appointments created`);

    // Create Calendar Tasks (tasks with startDate/endDate)
    const calendarTasks = [
      {
        title: 'Code Review Session',
        description: 'Review pull requests and provide feedback',
        startDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
        allDay: false,
        projectId: createdProjects[1]._id,
        assignedTo: [staff1._id, staff2._id],
        createdBy: operationsManager._id,
        status: 'Not Started',
        priority: 'High',
        color: '#3B82F6'
      },
      {
        title: 'Deployment Window',
        description: 'Scheduled deployment to production',
        startDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
        allDay: false,
        projectId: createdProjects[1]._id,
        assignedTo: [staff1._id],
        createdBy: operationsManager._id,
        status: 'Not Started',
        priority: 'Urgent',
        color: '#EF4444'
      }
    ];

    for (const taskData of calendarTasks) {
      await Task.create({
        ...taskData,
        companyId: company._id
      });
    }
    console.log(`${calendarTasks.length} Calendar Tasks created`);

    // Create Tab Configs for owner
    const tabConfigs = [
      {
        userId: owner._id,
        context: 'myTasks',
        tabs: [
          { id: 'list', label: 'List', order: 0, isVisible: true, isDefault: true },
          { id: 'board', label: 'Board', order: 1, isVisible: true },
          { id: 'calendar', label: 'Calendar', order: 2, isVisible: true },
          { id: 'dashboard', label: 'Dashboard', order: 3, isVisible: true },
          { id: 'files', label: 'Files', order: 4, isVisible: true },
          { id: 'notes', label: 'Notes', order: 5, isVisible: true }
        ]
      },
      {
        userId: owner._id,
        context: 'project',
        contextId: createdProjects[0]._id,
        tabs: [
          { id: 'overview', label: 'Overview', order: 0, isVisible: true, isDefault: true },
          { id: 'list', label: 'List', order: 1, isVisible: true },
          { id: 'board', label: 'Board', order: 2, isVisible: true },
          { id: 'calendar', label: 'Calendar', order: 3, isVisible: true },
          { id: 'dashboard', label: 'Dashboard', order: 4, isVisible: true },
          { id: 'timeline', label: 'Timeline', order: 5, isVisible: true },
          { id: 'workflow', label: 'Workflow', order: 6, isVisible: true },
          { id: 'messages', label: 'Messages', order: 7, isVisible: true },
          { id: 'notes', label: 'Notes', order: 8, isVisible: true },
          { id: 'files', label: 'Files', order: 9, isVisible: true }
        ]
      },
      {
        userId: owner._id,
        context: 'team',
        contextId: createdTeams[0]._id,
        tabs: [
          { id: 'overview', label: 'Overview', order: 0, isVisible: true, isDefault: true },
          { id: 'members', label: 'Members', order: 1, isVisible: true },
          { id: 'messages', label: 'Messages', order: 2, isVisible: true },
          { id: 'allwork', label: 'All Work', order: 3, isVisible: true },
          { id: 'calendar', label: 'Calendar', order: 4, isVisible: true },
          { id: 'knowledge', label: 'Knowledge', order: 5, isVisible: true },
          { id: 'notes', label: 'Notes', order: 6, isVisible: true }
        ]
      }
    ];

    for (const configData of tabConfigs) {
      await TabConfig.create({
        ...configData,
        companyId: company._id
      });
    }
    console.log(`${tabConfigs.length} Tab Configs created`);

    console.log('\n✅ Seed data created successfully!');
    console.log('\nLogin credentials:');
    console.log('Super Admin: admin@cayco.com / admin123');
    console.log('Company Owner: owner@demo.com / password123');
    console.log('Operations Manager: ops@demo.com / password123');
    console.log('Estimator: estimator@demo.com / password123');
    console.log('Accountant: accountant@demo.com / password123');
    console.log('Staff: staff1@demo.com / password123');
    console.log('\nAll users use the same password: password123');

    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
};

seedData();