import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ProjectFormProps {
  projectData: any;
  setProjectData: (data: any) => void;
}

export const ProjectForm = ({ projectData, setProjectData }: ProjectFormProps) => {
  const handleInputChange = (field: string, value: string) => {
    setProjectData({ ...projectData, [field]: value });
  };

  return (
    <Card className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-6">Project Information</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="projectName">Project Name</Label>
            <Input
              id="projectName"
              value={projectData.projectName}
              onChange={(e) => handleInputChange('projectName', e.target.value)}
              placeholder="Enter project name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="clientName">Client Name</Label>
            <Input
              id="clientName"
              value={projectData.clientName}
              onChange={(e) => handleInputChange('clientName', e.target.value)}
              placeholder="Enter client name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customerCode">D-Customer Code</Label>
            <Input
              id="customerCode"
              value={projectData.customerCode}
              onChange={(e) => handleInputChange('customerCode', e.target.value)}
              placeholder="Enter customer code"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={projectData.date}
              onChange={(e) => handleInputChange('date', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={projectData.location}
              onChange={(e) => handleInputChange('location', e.target.value)}
              placeholder="Installation site"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="drawingType">Drawing Type</Label>
            <Select
              value={projectData.drawingType}
              onValueChange={(value) => handleInputChange('drawingType', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select drawing type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="shop">Shop Drawing</SelectItem>
                <SelectItem value="production">Production Drawing</SelectItem>
                <SelectItem value="both">Both</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sheetType">Sheet Material</Label>
            <Select
              value={projectData.sheetType}
              onValueChange={(value) => handleInputChange('sheetType', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select sheet type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="202">Sheet 202</SelectItem>
                <SelectItem value="304">Sheet 304</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="modelType">3D Model Type</Label>
            <Select
              value={projectData.modelType || ''}
              onValueChange={(value) => handleInputChange('modelType', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select model type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="wall_mounted_skin">WALL MOUNTED SINGLE SKIN</SelectItem>
                <SelectItem value="wall_mounted_single_plenum">WALL MOUNTED SINGLE PLENUM</SelectItem>
                <SelectItem value="wall_mounted_double_skin">WALL-MOUNTED DOUBLE SKIN</SelectItem>
                <SelectItem value="wall_mounted_compensating">WALL-MOUNTED COMPENSATING</SelectItem>
                <SelectItem value="uv_compensating">UV COMPENSATING</SelectItem>
                <SelectItem value="island_single_skin">ISLAND SINGLE SKIN</SelectItem>
                <SelectItem value="island_double_skin">ISLAND DOUBLE SKIN</SelectItem>
                <SelectItem value="island_compensating">ISLAND COMPENSATING</SelectItem>
              </SelectContent>
            </Select>
          </div>

        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4">Dimensional Configuration</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((section) => (
            <div key={section} className="space-y-2">
              <Label htmlFor={`dimSection${section}`}>Dim Section {section}</Label>
              <Input
                id={`dimSection${section}`}
                type="number"
                value={projectData[`dimSection${section}`] || ''}
                onChange={(e) => handleInputChange(`dimSection${section}`, e.target.value)}
                placeholder="0"
              />
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
};
